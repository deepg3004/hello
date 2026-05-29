// POST /api/checkout/create-order
//
// Body: {
//   page_id, product_id, buyer_email, buyer_name, buyer_phone,
//   amount,            // client-supplied — server re-validates against products.price
//   coupon_code?,      // optional
//   utm_source?, utm_medium?, utm_campaign?
// }
//
// Returns the data the client needs to launch Razorpay Checkout:
//   { razorpay_order_id, amount, currency, key, name, description,
//     buyer_name, buyer_email, buyer_phone, order_id }

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { createOrder } from "@/lib/razorpay";
import {
  reserveCoupon,
  releaseCoupon,
  validateCoupon,
} from "@/lib/coupons";
import { effectiveCommissionPercent, type PlanKey } from "@/lib/plans";

export async function POST(request: Request) {
  let body: {
    page_id?: string;
    product_id?: string;
    buyer_email?: string;
    buyer_name?: string;
    buyer_phone?: string;
    amount?: number;
    coupon_code?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    page_id,
    product_id,
    buyer_email,
    buyer_name,
    buyer_phone,
    coupon_code,
    utm_source,
    utm_medium,
    utm_campaign,
  } = body;

  if (!page_id || !product_id || !buyer_email) {
    return NextResponse.json(
      { error: "page_id, product_id and buyer_email are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 1. Validate page is published
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, slug, status, title")
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json(
      { error: "Page is not available" },
      { status: 404 },
    );
  }

  // 2. Server-side price (never trust client `amount`)
  const { data: product } = await admin
    .from("products")
    .select("id, user_id, price, currency, name, active")
    .eq("id", product_id)
    .single();
  if (!product || !product.active || product.user_id !== page.user_id) {
    return NextResponse.json(
      { error: "Product is not available" },
      { status: 404 },
    );
  }
  const grossAmount = Number(product.price);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return NextResponse.json({ error: "Product has no price" }, { status: 400 });
  }
  const currency = product.currency ?? "INR";

  // 3. Coupon (optional)
  let discountAmount = 0;
  let couponId: string | null = null;
  let couponTotalLimit: number | null = null;
  let couponPerCustomerLimit: number | null = null;
  if (coupon_code) {
    const validation = await validateCoupon({
      code: coupon_code,
      page_id,
      amount: grossAmount,
      buyer_email,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }
    discountAmount = validation.discount_amount;
    couponId = validation.coupon_id;

    // Pull limits to feed reserveCoupon.
    const { data: cRow } = await admin
      .from("coupons")
      .select("total_limit, per_customer_limit")
      .eq("id", couponId)
      .single();
    couponTotalLimit = cRow?.total_limit ?? null;
    couponPerCustomerLimit = cRow?.per_customer_limit ?? null;

    const reserved = await reserveCoupon(
      couponId,
      couponTotalLimit,
      buyer_email,
      couponPerCustomerLimit,
    );
    if (!reserved) {
      return NextResponse.json({ error: "Coupon just sold out" }, { status: 409 });
    }
  }

  const netAmount = Math.max(0, grossAmount - discountAmount);

  // 4. Seller — lookup plan to determine effective commission
  const { data: seller } = await admin
    .from("user_profiles")
    .select("id, subscription_plan, razorpay_linked_account_id")
    .eq("id", page.user_id)
    .single();
  if (!seller) {
    if (couponId) await releaseCoupon(couponId, buyer_email);
    return NextResponse.json({ error: "Seller missing" }, { status: 404 });
  }

  const defaultPct = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 5);
  const planKey = (seller.subscription_plan ?? "free") as PlanKey;
  const commissionPct = effectiveCommissionPercent(planKey, defaultPct);
  const commissionAmount = Math.round(((netAmount * commissionPct) / 100) * 100) / 100;
  const sellerAmount = Math.round((netAmount - commissionAmount) * 100) / 100;

  const amountPaise = Math.round(netAmount * 100);
  const sellerAmountPaise = Math.round(sellerAmount * 100);

  // 5. Allocate an internal order id up front so Razorpay's `receipt` and
  //    our DB row share it (and so we can pass it through `notes`).
  const orderId = crypto.randomUUID();
  const shortReceipt = nanoid(10);

  // 6. Razorpay order — include Route transfer to the seller's linked account
  //    if we have one. If we don't, the platform keeps the full amount in
  //    escrow until the seller verifies their bank (manual payout later).
  let razorpayOrder: { id: string; amount: number | string } | null = null;
  try {
    razorpayOrder = (await createOrder({
      amount: amountPaise,
      currency,
      receipt: shortReceipt,
      notes: {
        invoxai_order_id: orderId,
        invoxai_page_id: page_id,
        invoxai_product_id: product_id,
        invoxai_seller_id: seller.id,
        buyer_email,
      },
      transfers:
        seller.razorpay_linked_account_id && sellerAmountPaise > 0
          ? [
              {
                account: seller.razorpay_linked_account_id,
                amount: sellerAmountPaise,
                currency,
                on_hold: 0,
                notes: { invoxai_order_id: orderId },
              },
            ]
          : undefined,
    })) as unknown as { id: string; amount: number | string };
  } catch (err) {
    if (couponId) await releaseCoupon(couponId, buyer_email);
    const message = err instanceof Error ? err.message : "Razorpay error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 7. Persist a pending order
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error: insertErr } = await admin.from("orders").insert({
    id: orderId,
    page_id,
    seller_user_id: page.user_id,
    product_id,
    buyer_email,
    buyer_name: buyer_name ?? null,
    buyer_phone: buyer_phone ?? null,
    amount: netAmount,
    platform_commission: commissionAmount,
    seller_amount: sellerAmount,
    currency,
    status: "pending",
    payment_gateway: "razorpay",
    gateway_order_id: razorpayOrder.id,
    coupon_id: couponId,
    discount_amount: discountAmount,
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
    ip_address: ip,
  });
  if (insertErr) {
    // Order is live in Razorpay but not in our DB — log and continue. The
    // webhook will reconcile via notes.invoxai_order_id.
    console.error("orders insert failed", insertErr);
  }

  // 8. Record an abandoned_checkout immediately (marked recovered on success)
  await admin.from("abandoned_checkouts").insert({
    page_id,
    seller_user_id: page.user_id,
    buyer_email,
    buyer_phone: buyer_phone ?? null,
    buyer_name: buyer_name ?? null,
    amount: netAmount,
    status: "active",
    recovery_token: nanoid(24),
    token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({
    ok: true,
    razorpay_order_id: razorpayOrder.id,
    order_id: orderId,
    amount: amountPaise,
    currency,
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    name: "InvoxAI",
    description: product.name,
    buyer_name: buyer_name ?? "",
    buyer_email,
    buyer_phone: buyer_phone ?? "",
    discount_amount: discountAmount,
    gross_amount: grossAmount,
  });
}
