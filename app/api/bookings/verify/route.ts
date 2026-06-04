// POST /api/bookings/verify
//
// Body: { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// Confirms a paid booking: verifies the signature with the SELLER's own secret,
// flips the booking to confirmed, records a paid order row (so the sale shows in
// revenue/transactions), and charges the per-order platform wallet fee.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { verifyPaymentWithSecret } from "@/lib/razorpay";
import { chargePlatformWalletFee } from "@/lib/order-fulfillment";
import { fireMarketingWebhook } from "@/lib/marketing";

export async function POST(request: Request) {
  let body: {
    booking_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, seller_user_id, booking_type_id, buyer_email, buyer_name, buyer_phone, amount, status, gateway_order_id, order_id",
    )
    .eq("id", booking_id)
    .maybeSingle();
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.gateway_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  // Verify with the seller's own secret (seller-gateway booking).
  const keys = await loadSellerGatewayKeys(booking.seller_user_id);
  const ok = keys
    ? verifyPaymentWithSecret(
        { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        keys.key_secret,
      )
    : false;
  if (!ok) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
  }

  // Idempotent — already confirmed.
  if (booking.status === "confirmed") {
    return NextResponse.json({ ok: true, already: true });
  }

  // Record a paid order row for revenue/transactions (full amount → seller).
  const { data: order } = await admin
    .from("orders")
    .insert({
      seller_user_id: booking.seller_user_id,
      buyer_email: booking.buyer_email,
      buyer_name: booking.buyer_name,
      buyer_phone: booking.buyer_phone,
      amount: Number(booking.amount),
      seller_amount: Number(booking.amount),
      platform_commission: 0,
      status: "paid",
      payment_gateway: "razorpay",
      gateway_owner: "seller",
      gateway_order_id: razorpay_order_id,
      gateway_payment_id: razorpay_payment_id,
      gateway_signature: razorpay_signature,
    })
    .select("id")
    .single();

  await admin
    .from("bookings")
    .update({ status: "confirmed", order_id: order?.id ?? null })
    .eq("id", booking_id)
    .eq("status", "pending");

  if (order?.id) {
    await admin.from("transactions").insert({
      user_id: booking.seller_user_id,
      order_id: order.id,
      type: "sale",
      amount: Number(booking.amount),
      status: "completed",
      reference_id: razorpay_payment_id,
      notes: `Booking ${booking_id.slice(-8)}`,
    });
    await chargePlatformWalletFee(
      { sellerUserId: booking.seller_user_id, orderId: order.id },
      admin,
    );
  }

  await fireMarketingWebhook(booking.seller_user_id, "booking_created", {
    booking_id: booking.id,
    buyer_email: booking.buyer_email,
    amount: Number(booking.amount ?? 0),
  });

  return NextResponse.json({ ok: true });
}
