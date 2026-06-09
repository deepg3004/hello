// POST /api/events/verify
//
// Confirms a PAID event registration: verifies the seller-gateway signature,
// records a paid order row (mirrors bookings/verify), flips the registration to
// confirmed, charges the platform wallet fee, and emails the attendee.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentWithSecret } from "@/lib/razorpay";
import { loadSellerGatewayKeys, type GatewayType } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";
import { finalizePaidEventRegistration } from "@/lib/event-booking-fulfillment";

export async function POST(request: Request) {
  let body: {
    registration_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { registration_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!registration_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("event_registrations")
    .select(
      "id, status, amount, gateway_order_id, buyer_email, buyer_name, buyer_phone, booking_event_id, booking_events!inner(user_id, title, start_at, location)",
    )
    .eq("id", registration_id)
    .maybeSingle();
  if (!reg) return NextResponse.json({ error: "Registration not found" }, { status: 404 });

  type Ev = { user_id: string; title: string; start_at: string; location: string | null };
  const bj = (reg as unknown as { booking_events: Ev | Ev[] }).booking_events;
  const ev = Array.isArray(bj) ? bj[0] : bj;

  if (reg.status === "confirmed") {
    return NextResponse.json({ ok: true, registration_id, already: true });
  }

  // Confirm on the seller's gateway: Razorpay by signature, Cashfree by status.
  const keys = await loadSellerGatewayKeys(ev.user_id);
  const provider = (keys?.gateway_type ?? "razorpay") as GatewayType;
  let valid = false;
  let paymentRef: string | null = null;
  let signatureRef: string | null = null;
  if (provider === "razorpay") {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (reg.gateway_order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
    }
    valid = keys
      ? verifyPaymentWithSecret(
          { razorpay_order_id, razorpay_payment_id, razorpay_signature },
          keys.key_secret,
        )
      : false;
    paymentRef = razorpay_payment_id;
    signatureRef = razorpay_signature;
  } else if (keys && isLiveGateway(provider)) {
    valid = reg.gateway_order_id
      ? await getGateway(provider).verifyPayment(keys, {
          orderId: reg.gateway_order_id,
        })
      : false;
    paymentRef = reg.gateway_order_id ?? null;
  } else {
    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  }
  if (!valid) return NextResponse.json({ error: "Payment not confirmed" }, { status: 401 });

  // Finalize via the shared, race-safe helper (guarded transition first, then
  // order + ledger + wallet fee + confirmation email). Same path the webhook
  // fallback uses.
  const res = await finalizePaidEventRegistration(
    registration_id,
    { provider, paymentRef, signatureRef },
    admin,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, registration_id, already: res.already });
}
