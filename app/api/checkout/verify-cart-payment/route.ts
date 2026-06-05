// POST /api/checkout/verify-cart-payment
//
// Confirms a multi-item cart order (Store Phase 2b). Separate from the
// single-item verify-payment so the live path is untouched. Verifies the
// seller-gateway signature, finalizes the order exactly-once, decrements stock
// per line item, charges the platform wallet fee once, and emails a receipt.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentWithSecret } from "@/lib/razorpay";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { chargePlatformWalletFee } from "@/lib/order-fulfillment";
import { fulfillCartOrder } from "@/lib/cart-fulfillment";

export async function POST(request: Request) {
  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    order_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, seller_user_id, buyer_email, buyer_name, source, gateway_owner")
    .eq("id", order_id)
    .single();
  if (!order || order.source !== "cart") {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, order_id, redirect_url: `/order/${order_id}`, already_paid: true });
  }

  // Verify the signature with the seller's own gateway secret.
  const keys = await loadSellerGatewayKeys(order.seller_user_id);
  const valid = keys
    ? verifyPaymentWithSecret(
        { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        keys.key_secret,
      )
    : false;
  if (!valid) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
  }

  // Atomic pending→paid so every side-effect runs exactly once.
  const { data: paidRows } = await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: razorpay_payment_id,
      gateway_signature: razorpay_signature,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order_id)
    .eq("status", "pending")
    .select("id");
  if (!paidRows || paidRows.length === 0) {
    return NextResponse.json({ ok: true, order_id, redirect_url: `/order/${order_id}`, already_paid: true });
  }

  // Platform wallet fee — once per order (idempotent at the RPC layer).
  try {
    await chargePlatformWalletFee({ sellerUserId: order.seller_user_id, orderId: order_id }, admin);
  } catch (e) {
    console.error("[verify-cart] wallet fee failed", e);
  }

  // Per-line stock + itemized receipt (shared with the seller-webhook fallback).
  await fulfillCartOrder(
    {
      id: order_id,
      buyer_email: order.buyer_email,
      buyer_name: order.buyer_name,
      seller_user_id: order.seller_user_id,
    },
    admin,
  );

  return NextResponse.json({ ok: true, order_id, redirect_url: `/order/${order_id}` });
}
