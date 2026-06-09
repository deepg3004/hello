// POST /api/bookings/verify
//
// Body: { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// Confirms a paid booking: verifies the signature with the SELLER's own secret,
// flips the booking to confirmed, records a paid order row (so the sale shows in
// revenue/transactions), and charges the per-order platform wallet fee.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadSellerGatewayKeys, type GatewayType } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";
import { verifyPaymentWithSecret } from "@/lib/razorpay";
import { finalizePaidBooking } from "@/lib/event-booking-fulfillment";

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
  if (!booking_id) {
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

  // Confirm on the seller's gateway (one gateway per seller → provider is the
  // seller's currently-configured one). Razorpay by signature; Cashfree by
  // order status.
  const keys = await loadSellerGatewayKeys(booking.seller_user_id);
  const provider = (keys?.gateway_type ?? "razorpay") as GatewayType;
  let ok = false;
  let paymentRef: string | null = null;
  let signatureRef: string | null = null;
  if (provider === "razorpay") {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (booking.gateway_order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
    }
    ok = keys
      ? verifyPaymentWithSecret(
          { razorpay_order_id, razorpay_payment_id, razorpay_signature },
          keys.key_secret,
        )
      : false;
    paymentRef = razorpay_payment_id;
    signatureRef = razorpay_signature;
  } else if (keys && isLiveGateway(provider)) {
    ok = booking.gateway_order_id
      ? await getGateway(provider).verifyPayment(keys, {
          orderId: booking.gateway_order_id,
        })
      : false;
    paymentRef = booking.gateway_order_id ?? null;
  } else {
    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  }
  if (!ok) {
    return NextResponse.json({ error: "Payment not confirmed" }, { status: 401 });
  }

  // Idempotent — already confirmed.
  if (booking.status === "confirmed") {
    return NextResponse.json({ ok: true, already: true });
  }

  // Finalize via the shared, race-safe helper (guarded transition first, then
  // order + ledger + wallet fee). Same path the webhook fallback uses.
  const res = await finalizePaidBooking(
    booking_id,
    { provider, paymentRef, signatureRef },
    admin,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, already: res.already });
}
