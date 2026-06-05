// POST /api/events/verify
//
// Confirms a PAID event registration: verifies the seller-gateway signature,
// records a paid order row (mirrors bookings/verify), flips the registration to
// confirmed, charges the platform wallet fee, and emails the attendee.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentWithSecret } from "@/lib/razorpay";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { chargePlatformWalletFee } from "@/lib/order-fulfillment";
import { fireMarketingWebhook } from "@/lib/marketing";
import { sendEmail } from "@/lib/email";
import { SHELL } from "@/lib/emails/layout";
import { formatSlotLabel } from "@/lib/booking";

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
  if (!registration_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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
  if (reg.gateway_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  const keys = await loadSellerGatewayKeys(ev.user_id);
  const valid = keys
    ? verifyPaymentWithSecret(
        { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        keys.key_secret,
      )
    : false;
  if (!valid) return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });

  // Record a paid order (mirrors the 1:1 booking verify) — one order per
  // registration so each gets its own wallet fee.
  const { data: order } = await admin
    .from("orders")
    .insert({
      seller_user_id: ev.user_id,
      buyer_email: reg.buyer_email,
      buyer_name: reg.buyer_name,
      buyer_phone: reg.buyer_phone,
      amount: Number(reg.amount),
      seller_amount: Number(reg.amount),
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

  // Atomic pending→confirmed.
  const { data: updated } = await admin
    .from("event_registrations")
    .update({ status: "confirmed", order_id: order?.id ?? null })
    .eq("id", registration_id)
    .eq("status", "pending")
    .select("id");
  if (!updated || updated.length === 0) {
    return NextResponse.json({ ok: true, registration_id, already: true });
  }

  await admin.from("transactions").insert({
    user_id: ev.user_id,
    order_id: order?.id ?? null,
    type: "sale",
    amount: Number(reg.amount),
    status: "completed",
    reference_id: razorpay_payment_id,
    notes: `Event registration — ${ev.title}`,
  });

  if (order?.id) {
    try {
      await chargePlatformWalletFee({ sellerUserId: ev.user_id, orderId: order.id }, admin);
    } catch (e) {
      console.error("[events/verify] wallet fee failed", e);
    }
  }

  await fireMarketingWebhook(ev.user_id, "booking_created", {
    event_id: reg.booking_event_id,
    registration_id,
    title: ev.title,
    start_at: ev.start_at,
    buyer_email: reg.buyer_email,
    amount: Number(reg.amount),
  });

  // Confirmation email.
  try {
    const when = formatSlotLabel(ev.start_at);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
    await sendEmail({
      to: reg.buyer_email,
      sellerId: ev.user_id,
      role: "buyer",
      subject: `You're registered — ${ev.title}`,
      html: SHELL(
        `<h2 style="margin:0 0 12px;font-size:20px">You're registered ✅</h2>
         <p style="margin:0 0 8px">Your spot for <strong>${ev.title}</strong> is confirmed.</p>
         <p style="margin:0 0 8px">🗓 ${when} (IST)</p>
         ${ev.location ? `<p style="margin:0 0 8px">📍 ${ev.location}</p>` : ""}
         <p style="margin:16px 0 8px"><a href="${base}/api/events/${registration_id}/ics" style="color:#4f46e5">📅 Add to calendar (.ics)</a></p>`,
        { preheader: `Registered for ${ev.title}` },
      ),
    });
  } catch (e) {
    console.error("[events/verify] email failed", e);
  }

  return NextResponse.json({ ok: true, registration_id });
}
