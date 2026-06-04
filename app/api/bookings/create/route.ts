// POST /api/bookings/create
//
// Body: { slug, start_iso, buyer_name, buyer_email, buyer_phone }
//
// Free booking (price 0) → insert a confirmed booking + email. Paid booking →
// require the seller's own gateway, create a razorpay order on their keys, hold
// the slot with a pending booking, and return checkout params. The slot is
// re-validated server-side against the booking type's availability.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { createOrderOnKeys } from "@/lib/razorpay";
import { generateSlots, type AvailabilityWindow } from "@/lib/booking";
import { sendEmail } from "@/lib/email";
import { SHELL } from "@/lib/emails/layout";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  let body: {
    slug?: string;
    start_iso?: string;
    buyer_name?: string;
    buyer_email?: string;
    buyer_phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const startIso = body.start_iso?.trim();
  const email = body.buyer_email?.trim().toLowerCase();
  if (!slug || !startIso || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const rl = await rateLimit(`booking:${email}:${clientIp(request)}`, 8, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();
  const { data: bt } = await admin
    .from("booking_types")
    .select("id, user_id, title, duration_min, buffer_min, price, currency, location, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!bt || !bt.active) {
    return NextResponse.json({ error: "Booking not available" }, { status: 404 });
  }

  // Re-validate the slot against availability + existing bookings.
  const [{ data: avail }, { data: booked }] = await Promise.all([
    admin
      .from("booking_availability")
      .select("weekday, start_min, end_min")
      .eq("booking_type_id", bt.id),
    admin
      .from("bookings")
      .select("start_at")
      .eq("booking_type_id", bt.id)
      .in("status", ["pending", "confirmed"]),
  ]);
  const bookedIsos = new Set(
    (booked ?? []).map((b) => new Date(b.start_at as string).toISOString()),
  );
  const slots = generateSlots({
    availability: (avail ?? []) as AvailabilityWindow[],
    durationMin: bt.duration_min,
    bufferMin: bt.buffer_min,
    bookedIsos,
    now: Date.now(),
  });
  const wanted = new Date(startIso).toISOString();
  if (!slots.some((s) => s.startIso === wanted)) {
    return NextResponse.json(
      { error: "That slot is no longer available. Pick another." },
      { status: 409 },
    );
  }

  const startAt = new Date(wanted);
  const endAt = new Date(startAt.getTime() + bt.duration_min * 60_000);
  const price = Number(bt.price ?? 0);
  const paid = price > 0;

  // ── Free → confirm immediately ─────────────────────────────────────────────
  if (!paid) {
    const { data: row, error } = await admin
      .from("bookings")
      .insert({
        booking_type_id: bt.id,
        seller_user_id: bt.user_id,
        buyer_name: body.buyer_name?.trim() || null,
        buyer_email: email,
        buyer_phone: body.buyer_phone?.trim() || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: "confirmed",
        amount: 0,
      })
      .select("id")
      .single();
    if (error || !row) {
      // Unique-index violation = someone grabbed the slot first.
      return NextResponse.json(
        { error: "That slot was just taken. Pick another." },
        { status: 409 },
      );
    }
    await sendBookingEmail(email, bt.title, wanted, bt.location);
    return NextResponse.json({ ok: true, free: true, booking_id: row.id });
  }

  // ── Paid → seller gateway required, hold the slot, return checkout ──────────
  const keys = await loadSellerGatewayKeys(bt.user_id);
  if (!keys || keys.gateway_type !== "razorpay") {
    return NextResponse.json(
      { error: "This booking can't take payments yet." },
      { status: 402 },
    );
  }

  const amountPaise = Math.round(price * 100);
  let rzpOrder: { id: string };
  try {
    rzpOrder = (await createOrderOnKeys(
      { key_id: keys.key_id, key_secret: keys.key_secret },
      {
        amount: amountPaise,
        currency: bt.currency ?? "INR",
        receipt: nanoid(10),
        notes: { kind: "booking", booking_slug: slug },
      },
    )) as unknown as { id: string };
  } catch (e) {
    console.error("[bookings/create] razorpay order failed", e);
    return NextResponse.json(
      { error: "Payment gateway temporarily unavailable." },
      { status: 502 },
    );
  }

  const { data: row, error } = await admin
    .from("bookings")
    .insert({
      booking_type_id: bt.id,
      seller_user_id: bt.user_id,
      buyer_name: body.buyer_name?.trim() || null,
      buyer_email: email,
      buyer_phone: body.buyer_phone?.trim() || null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "pending",
      amount: price,
      gateway_order_id: rzpOrder.id,
    })
    .select("id")
    .single();
  if (error || !row) {
    return NextResponse.json(
      { error: "That slot was just taken. Pick another." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    paid: true,
    booking_id: row.id,
    razorpay_order_id: rzpOrder.id,
    amount: amountPaise,
    currency: bt.currency ?? "INR",
    key: keys.key_id,
    title: bt.title,
    buyer_name: body.buyer_name ?? "",
    buyer_email: email,
    buyer_phone: body.buyer_phone ?? "",
  });
}

async function sendBookingEmail(
  to: string,
  title: string,
  startIso: string,
  location: string | null,
): Promise<void> {
  try {
    const { formatSlotLabel } = await import("@/lib/booking");
    const when = formatSlotLabel(startIso);
    await sendEmail({
      to,
      role: "buyer",
      subject: `Booking confirmed — ${title}`,
      html: SHELL(
        `
        <h2 style="margin:0 0 12px;font-size:20px">Booking confirmed ✅</h2>
        <p style="margin:0 0 8px">Your booking for <strong>${title}</strong> is confirmed.</p>
        <p style="margin:0 0 8px">🗓 ${when} (IST)</p>
        ${location ? `<p style="margin:0 0 8px">📍 ${location}</p>` : ""}
        `,
        { preheader: `Booking confirmed for ${title}` },
      ),
    });
  } catch (e) {
    console.error("[bookings] confirm email failed", e);
  }
}
