// Shared finalizers for PAID 1:1 bookings and group-event registrations. Used by
// the in-app verify routes (app/api/bookings/verify, app/api/events/verify) AND
// the seller-gateway webhooks — so a paid booking/event whose buyer tab dropped
// before the in-app verify call still gets confirmed (records the order, charges
// the wallet fee, emails the buyer) when the webhook arrives.
//
// Both finalizers do the guarded pending→confirmed transition FIRST and only the
// winner records the order — so a replayed/concurrent confirm can't insert an
// orphan paid order or double-charge the wallet fee.

import type { SupabaseClient } from "@supabase/supabase-js";

import { chargePlatformWalletFee } from "@/lib/order-fulfillment";
import { fireMarketingWebhook } from "@/lib/marketing";
import type { GatewayType } from "@/lib/gateway-loader";

type DB = SupabaseClient;

export interface FinalizeOpts {
  provider: GatewayType;
  paymentRef: string | null;
  signatureRef: string | null;
}

export interface FinalizeResult {
  ok: boolean;
  already?: boolean;
  orderId?: string;
}

/** Confirm a paid 1:1 booking (race-safe). */
export async function finalizePaidBooking(
  bookingId: string,
  opts: FinalizeOpts,
  admin: DB,
): Promise<FinalizeResult> {
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, seller_user_id, buyer_email, buyer_name, buyer_phone, amount, status, gateway_order_id",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false };

  // Guarded transition FIRST — only the winner records the order.
  const { data: won } = await admin
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select("id");
  if (!won || won.length === 0) return { ok: true, already: true };

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
      payment_gateway: opts.provider,
      gateway_owner: "seller",
      gateway_order_id: booking.gateway_order_id,
      gateway_payment_id: opts.paymentRef,
      gateway_signature: opts.signatureRef,
    })
    .select("id")
    .single();

  await admin
    .from("bookings")
    .update({ order_id: order?.id ?? null })
    .eq("id", bookingId);

  if (order?.id) {
    await admin.from("transactions").insert({
      user_id: booking.seller_user_id,
      order_id: order.id,
      type: "sale",
      amount: Number(booking.amount),
      status: "completed",
      reference_id: opts.paymentRef,
      notes: `Booking ${bookingId.slice(-8)}`,
    });
    try {
      await chargePlatformWalletFee(
        { sellerUserId: booking.seller_user_id, orderId: order.id },
        admin,
      );
    } catch (e) {
      console.error("[finalizePaidBooking] wallet fee failed", e);
    }
  }

  await fireMarketingWebhook(booking.seller_user_id, "booking_created", {
    booking_id: booking.id,
    buyer_email: booking.buyer_email,
    amount: Number(booking.amount ?? 0),
  });

  return { ok: true, orderId: order?.id };
}

/** Confirm a paid group-event registration (race-safe) + email the attendee. */
export async function finalizePaidEventRegistration(
  registrationId: string,
  opts: FinalizeOpts,
  admin: DB,
): Promise<FinalizeResult> {
  const { data: reg } = await admin
    .from("event_registrations")
    .select(
      "id, status, amount, gateway_order_id, buyer_email, buyer_name, buyer_phone, booking_event_id, booking_events!inner(user_id, title, start_at, location)",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { ok: false };

  type Ev = { user_id: string; title: string; start_at: string; location: string | null };
  const bj = (reg as unknown as { booking_events: Ev | Ev[] }).booking_events;
  const ev = Array.isArray(bj) ? bj[0] : bj;

  // Guarded transition FIRST.
  const { data: updated } = await admin
    .from("event_registrations")
    .update({ status: "confirmed" })
    .eq("id", registrationId)
    .eq("status", "pending")
    .select("id");
  if (!updated || updated.length === 0) return { ok: true, already: true };

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
      payment_gateway: opts.provider,
      gateway_owner: "seller",
      gateway_order_id: reg.gateway_order_id,
      gateway_payment_id: opts.paymentRef,
      gateway_signature: opts.signatureRef,
    })
    .select("id")
    .single();

  await admin
    .from("event_registrations")
    .update({ order_id: order?.id ?? null })
    .eq("id", registrationId);

  await admin.from("transactions").insert({
    user_id: ev.user_id,
    order_id: order?.id ?? null,
    type: "sale",
    amount: Number(reg.amount),
    status: "completed",
    reference_id: opts.paymentRef,
    notes: `Event registration — ${ev.title}`,
  });

  if (order?.id) {
    try {
      await chargePlatformWalletFee({ sellerUserId: ev.user_id, orderId: order.id }, admin);
    } catch (e) {
      console.error("[finalizePaidEventRegistration] wallet fee failed", e);
    }
  }

  await fireMarketingWebhook(ev.user_id, "booking_created", {
    event_id: reg.booking_event_id,
    registration_id: registrationId,
    title: ev.title,
    start_at: ev.start_at,
    buyer_email: reg.buyer_email,
    amount: Number(reg.amount),
  });

  // Confirmation email (best-effort).
  try {
    const { sendEmail } = await import("@/lib/email");
    const { SHELL } = await import("@/lib/emails/layout");
    const { formatSlotLabel } = await import("@/lib/booking");
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
         <p style="margin:16px 0 8px"><a href="${base}/api/events/${registrationId}/ics" style="color:#4f46e5">📅 Add to calendar (.ics)</a></p>`,
        { preheader: `Registered for ${ev.title}` },
      ),
    });
  } catch (e) {
    console.error("[finalizePaidEventRegistration] email failed", e);
  }

  return { ok: true, orderId: order?.id };
}

/**
 * Webhook helper: given a gateway order id, find a matching PENDING booking or
 * event registration and return enough to verify the signature + finalize. The
 * webhook verifies the signature against the seller before calling finalize.
 */
export async function findPendingBookingOrEvent(
  gatewayOrderId: string,
  admin: DB,
): Promise<
  | { kind: "booking"; id: string; sellerUserId: string }
  | { kind: "event"; id: string; sellerUserId: string }
  | null
> {
  const { data: booking } = await admin
    .from("bookings")
    .select("id, seller_user_id, status")
    .eq("gateway_order_id", gatewayOrderId)
    .eq("status", "pending")
    .maybeSingle();
  if (booking) {
    return { kind: "booking", id: booking.id, sellerUserId: booking.seller_user_id };
  }
  const { data: reg } = await admin
    .from("event_registrations")
    .select("id, status, booking_events!inner(user_id)")
    .eq("gateway_order_id", gatewayOrderId)
    .eq("status", "pending")
    .maybeSingle();
  if (reg) {
    type Ev = { user_id: string };
    const bj = (reg as unknown as { booking_events: Ev | Ev[] }).booking_events;
    const ev = Array.isArray(bj) ? bj[0] : bj;
    return { kind: "event", id: reg.id, sellerUserId: ev.user_id };
  }
  return null;
}
