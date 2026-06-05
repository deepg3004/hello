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
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { createOrderOnKeys } from "@/lib/razorpay";
import { validateCart, type CartItemInput } from "@/lib/cart";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

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

  const totalPaise = cart.subtotalPaise + shippingPaise;

  // No-funds model: the order is created on the seller's OWN Razorpay gateway.
  const keys = await loadSellerGatewayKeys(seller.id);
  const sellerGateway =
    keys && keys.gateway_type === "razorpay"
      ? { key_id: keys.key_id, key_secret: keys.key_secret }
      : null;
  if (!sellerGateway) {
    return NextResponse.json(
      { error: "This store can't accept payments yet." },
      { status: 402 },
    );
  }

  const orderId = crypto.randomUUID();
  let razorpayOrder: { id: string };
  try {
    razorpayOrder = (await createOrderOnKeys(sellerGateway, {
      amount: totalPaise,
      currency: "INR",
      receipt: nanoid(10),
      notes: { invoxai_order_id: orderId, invoxai_seller_id: seller.id, kind: "cart", buyer_email: email },
    })) as unknown as { id: string };
  } catch (err) {
    console.error("[create-cart-order] razorpay createOrder failed", err);
    return NextResponse.json(
      { error: "Payment gateway is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  const { error: orderErr } = await admin.from("orders").insert({
    id: orderId,
    seller_user_id: seller.id,
    buyer_email: email,
    buyer_name: body.buyer_name?.trim() || null,
    buyer_phone: body.buyer_phone?.trim() || null,
    amount: totalPaise / 100,
    shipping_fee: shippingPaise / 100,
    shipping_address: cart.requiresShipping ? addr : null,
    platform_commission: 0,
    seller_amount: totalPaise / 100,
    currency: "INR",
    status: "pending",
    source: "cart",
    payment_gateway: "razorpay",
    gateway_owner: "seller",
    gateway_order_id: razorpayOrder.id,
    ip_address: ip === "unknown" ? null : ip,
  });
  if (orderErr) {
    console.error("[create-cart-order] order insert failed", orderErr);
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 500 });
  }

  const itemRows = cart.lines.map((l) => ({
    order_id: orderId,
    product_id: l.product_id,
    name_snapshot: l.name,
    unit_price: l.unit_price_paise / 100,
    quantity: l.quantity,
    line_amount: l.line_paise / 100,
    requires_shipping: l.requires_shipping,
  }));
  const { error: itemsErr } = await admin.from("order_items").insert(itemRows);
  if (itemsErr) {
    console.error("[create-cart-order] order_items insert failed", itemsErr);
  }

  return NextResponse.json({
    ok: true,
    razorpay_order_id: razorpayOrder.id,
    order_id: orderId,
    amount: totalPaise,
    shipping_fee: shippingPaise / 100,
    currency: "INR",
    key: sellerGateway.key_id,
    name: "InvoxAI",
    description: `${cart.lines.length} item${cart.lines.length === 1 ? "" : "s"}`,
    buyer_name: body.buyer_name ?? "",
    buyer_email: email,
    buyer_phone: body.buyer_phone ?? "",
  });
}
