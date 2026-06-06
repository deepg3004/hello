// POST /api/checkout/create-cart-order
//
// Multi-item cart checkout (Store Phase 2b). Separate from the single-item
// create-order so the live single-product path is untouched. Creates ONE order
// header (source='cart', no page_id/product_id) + N order_items, and ONE
// Razorpay order on the SELLER's own gateway (one seller per cart). v1 carts
// hold only catalog products.

import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSellerGatewayOrder,
  gatewayClientFields,
} from "@/lib/checkout-gateway";
import { walletCoversPlatformFee } from "@/lib/order-fulfillment";
import { validateCart, type CartItemInput } from "@/lib/cart";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateCartCoupon, reserveCoupon, releaseCoupon } from "@/lib/coupons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

function cleanAddress(a: unknown): Address | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : undefined);
  return {
    line1: s(o.line1),
    line2: s(o.line2),
    city: s(o.city),
    state: s(o.state),
    pincode: s(o.pincode),
  };
}

export async function POST(request: Request) {
  let body: {
    items?: CartItemInput[];
    buyer_email?: string;
    buyer_name?: string;
    buyer_phone?: string;
    buyer_address?: unknown;
    coupon_code?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.buyer_email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`cart:${email}:${ip}`, 12, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const v = await validateCart(body.items ?? []);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
  const { cart } = v;

  const admin = createAdminClient();

  const { data: seller } = await admin
    .from("user_profiles")
    .select("id, shipping_flat_fee, free_shipping_over")
    .eq("id", cart.sellerId)
    .single();
  if (!seller) return NextResponse.json({ error: "Seller missing" }, { status: 404 });

  // Shipping — required address + flat fee (waived over the free threshold) when
  // any item is physical.
  const addr = cleanAddress(body.buyer_address);
  let shippingPaise = 0;
  if (cart.requiresShipping) {
    if (!addr || !addr.line1 || !addr.city || !addr.pincode) {
      return NextResponse.json(
        { error: "A delivery address (street, city, PIN) is required." },
        { status: 400 },
      );
    }
    const flatPaise = Math.round(Number(seller.shipping_flat_fee ?? 0) * 100);
    const freeOver = Number(seller.free_shipping_over ?? 0);
    const free = freeOver > 0 && cart.subtotalPaise >= Math.round(freeOver * 100);
    shippingPaise = free ? 0 : Math.max(0, flatPaise);
  }

  // Promo code (optional) — applies to the cart subtotal, not shipping.
  let discountPaise = 0;
  let couponId: string | null = null;
  if (body.coupon_code?.trim()) {
    const cv = await validateCartCoupon({
      code: body.coupon_code.trim(),
      seller_id: seller.id,
      amount: cart.subtotalPaise / 100,
      buyer_email: email,
    });
    if (!cv.valid) {
      return NextResponse.json({ error: cv.reason }, { status: 400 });
    }
    couponId = cv.coupon_id;
    discountPaise = Math.min(cart.subtotalPaise, Math.round(cv.discount_amount * 100));

    const { data: cRow } = await admin
      .from("coupons")
      .select("total_limit, per_customer_limit")
      .eq("id", couponId)
      .single();
    const reserved = await reserveCoupon(
      couponId,
      cRow?.total_limit ?? null,
      email,
      cRow?.per_customer_limit ?? null,
    );
    if (!reserved) {
      return NextResponse.json({ error: "Coupon just sold out" }, { status: 409 });
    }
  }

  const totalPaise = Math.max(0, cart.subtotalPaise - discountPaise) + shippingPaise;

  // Wallet gate: block checkout if the seller's wallet can't cover the platform
  // fee (when require_wallet_balance is on) — otherwise the sale completes but
  // the fee goes uncollected.
  if (
    !(await walletCoversPlatformFee(
      { sellerUserId: seller.id, orderAmountPaise: totalPaise },
      admin,
    ))
  ) {
    if (couponId) await releaseCoupon(couponId, email);
    return NextResponse.json(
      { error: "This store is temporarily unavailable. Please try again later." },
      { status: 402 },
    );
  }

  // No-funds model: the order is created on the seller's OWN gateway (any
  // supported provider — Razorpay, Cashfree, …) via the driver.
  const orderId = crypto.randomUUID();
  const gw = await createSellerGatewayOrder(seller.id, {
    amountPaise: totalPaise,
    currency: "INR",
    receipt: nanoid(10),
    notes: {
      invoxai_order_id: orderId,
      invoxai_seller_id: seller.id,
      kind: "cart",
      buyer_email: email,
    },
    customer: {
      name: body.buyer_name ?? undefined,
      email,
      phone: body.buyer_phone ?? undefined,
    },
  });
  if (!gw.ok) {
    if (couponId) await releaseCoupon(couponId, email);
    return NextResponse.json({ error: gw.error }, { status: gw.status });
  }

  const { error: orderErr } = await admin.from("orders").insert({
    id: orderId,
    seller_user_id: seller.id,
    buyer_email: email,
    buyer_name: body.buyer_name?.trim().slice(0, 120) || null,
    buyer_phone: body.buyer_phone?.trim().slice(0, 20) || null,
    amount: totalPaise / 100,
    shipping_fee: shippingPaise / 100,
    shipping_address: cart.requiresShipping ? addr : null,
    platform_commission: 0,
    seller_amount: totalPaise / 100,
    coupon_id: couponId,
    discount_amount: discountPaise / 100,
    currency: "INR",
    status: "pending",
    source: "cart",
    payment_gateway: gw.gateway,
    gateway_owner: "seller",
    gateway_order_id: gw.providerOrderId,
    ip_address: ip === "unknown" ? null : ip,
  });
  if (orderErr) {
    console.error("[create-cart-order] order insert failed", orderErr);
    if (couponId) await releaseCoupon(couponId, email);
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 500 });
  }

  const itemRows = cart.lines.map((l) => ({
    order_id: orderId,
    product_id: l.product_id,
    variant_id: l.variant_id,
    variant_name: l.variant_name,
    name_snapshot: l.name,
    unit_price: l.unit_price_paise / 100,
    quantity: l.quantity,
    line_amount: l.line_paise / 100,
    requires_shipping: l.requires_shipping,
  }));
  const { error: itemsErr } = await admin.from("order_items").insert(itemRows);
  if (itemsErr) {
    // Don't leave a payable header with no lines — roll it back.
    console.error("[create-cart-order] order_items insert failed", itemsErr);
    await admin.from("orders").delete().eq("id", orderId);
    if (couponId) await releaseCoupon(couponId, email);
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ...gatewayClientFields(gw.gateway, gw.providerOrderId, gw.client),
    order_id: orderId,
    amount: totalPaise,
    shipping_fee: shippingPaise / 100,
    discount_amount: discountPaise / 100,
    currency: "INR",
    name: "InvoxAI",
    description: `${cart.lines.length} item${cart.lines.length === 1 ? "" : "s"}`,
    buyer_name: body.buyer_name ?? "",
    buyer_email: email,
    buyer_phone: body.buyer_phone ?? "",
  });
}
