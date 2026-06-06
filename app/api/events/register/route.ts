// POST /api/events/register
//
// Body: { slug, buyer_name, buyer_email, buyer_phone }
//
// Group-event registration. Free → register_for_event RPC inserts a confirmed
// row (capacity-checked atomically) + email. Paid → require the seller's own
// gateway, create a Razorpay order on their keys, hold a seat with a pending
// registration, return checkout params (verify confirms it).

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSellerGatewayOrder,
  gatewayClientFields,
} from "@/lib/checkout-gateway";
import { walletCoversPlatformFee } from "@/lib/order-fulfillment";
import { fireMarketingWebhook } from "@/lib/marketing";
import { sendEmail } from "@/lib/email";
import { SHELL } from "@/lib/emails/layout";
import { formatSlotLabel } from "@/lib/booking";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  let body: { slug?: string; buyer_name?: string; buyer_email?: string; buyer_phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const email = body.buyer_email?.trim().toLowerCase();
  if (!slug || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const rl = await rateLimit(`event:${email}:${clientIp(request)}`, 8, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("booking_events")
    .select("id, user_id, title, start_at, end_at, capacity, price, currency, location, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!ev || !ev.active) {
    return NextResponse.json({ error: "Event not available" }, { status: 404 });
  }
  if (new Date(ev.start_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This event has already started." }, { status: 409 });
  }

  const price = Number(ev.price ?? 0);
  const paid = price > 0;

  // ── Free → confirm immediately (idempotent per email) ──────────────────────
  if (!paid) {
    const { data: existing } = await admin
      .from("event_registrations")
      .select("id")
      .eq("booking_event_id", ev.id)
      .eq("buyer_email", email)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, free: true, registration_id: existing.id, already: true });
    }

    const { data: regId, error } = await admin.rpc("register_for_event", {
      p_event_id: ev.id,
      p_buyer_name: body.buyer_name?.trim() || null,
      p_buyer_email: email,
      p_buyer_phone: body.buyer_phone?.trim() || null,
      p_status: "confirmed",
      p_amount: 0,
      p_gateway_order_id: null,
    });
    if (error) {
      console.error("[events/register] rpc failed", error);
      return NextResponse.json({ error: "Couldn't register. Try again." }, { status: 500 });
    }
    if (!regId) {
      return NextResponse.json({ error: "This event is full." }, { status: 409 });
    }
    await sendEventEmail(email, ev, regId as string, body.buyer_name, ev.user_id);
    await fireMarketingWebhook(ev.user_id, "booking_created", {
      event_id: ev.id,
      registration_id: regId,
      title: ev.title,
      start_at: ev.start_at,
      buyer_email: email,
      amount: 0,
    });
    return NextResponse.json({ ok: true, free: true, registration_id: regId });
  }

  // ── Paid → seller gateway, hold a seat, return checkout ────────────────────
  const amountPaise = Math.round(price * 100);
  if (
    !(await walletCoversPlatformFee(
      { sellerUserId: ev.user_id, orderAmountPaise: amountPaise },
      admin,
    ))
  ) {
    return NextResponse.json(
      { error: "This event is temporarily unavailable. Please try again later." },
      { status: 402 },
    );
  }
  const gw = await createSellerGatewayOrder(ev.user_id, {
    amountPaise,
    currency: ev.currency ?? "INR",
    receipt: nanoid(10),
    notes: { kind: "event", event_slug: slug },
    customer: {
      name: body.buyer_name ?? undefined,
      email,
      phone: body.buyer_phone ?? undefined,
    },
  });
  if (!gw.ok) {
    return NextResponse.json({ error: gw.error }, { status: gw.status });
  }

  const { data: regId, error } = await admin.rpc("register_for_event", {
    p_event_id: ev.id,
    p_buyer_name: body.buyer_name?.trim() || null,
    p_buyer_email: email,
    p_buyer_phone: body.buyer_phone?.trim() || null,
    p_status: "pending",
    p_amount: price,
    p_gateway_order_id: gw.providerOrderId,
  });
  if (error) {
    console.error("[events/register] rpc failed (paid)", error);
    return NextResponse.json({ error: "Couldn't register. Try again." }, { status: 500 });
  }
  if (!regId) {
    return NextResponse.json({ error: "This event is full." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    paid: true,
    registration_id: regId,
    ...gatewayClientFields(gw.gateway, gw.providerOrderId, gw.client),
    amount: amountPaise,
    currency: ev.currency ?? "INR",
    title: ev.title,
    buyer_name: body.buyer_name ?? "",
    buyer_email: email,
    buyer_phone: body.buyer_phone ?? "",
  });
}

interface EventLite {
  title: string;
  start_at: string;
  location: string | null;
}

async function sendEventEmail(
  to: string,
  ev: EventLite,
  registrationId: string,
  buyerName: string | null | undefined,
  sellerId?: string,
): Promise<void> {
  try {
    const when = formatSlotLabel(ev.start_at);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
    await sendEmail({
      to,
      sellerId,
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
    console.error("[events] confirm email failed", e);
  }
}
