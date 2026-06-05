// GET /api/bookings/[id]/ics
//
// Returns a downloadable .ics calendar invite for a single booking. Public —
// the booking id (a uuid) is the capability; it's the buyer's own confirmation
// link (shared in the confirmation email + buyer portal). Only confirmed/pending
// bookings produce a file.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingIcs } from "@/lib/booking-ics";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, start_at, end_at, status, buyer_email, seller_user_id, booking_types(title, description, location)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!b || b.status === "cancelled") {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const bt = Array.isArray(b.booking_types) ? b.booking_types[0] : b.booking_types;
  const title = bt?.title ?? "Booking";

  // Organizer email = seller (best-effort lookup; non-fatal).
  let organizerEmail: string | null = null;
  const { data: seller } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", b.seller_user_id)
    .maybeSingle();
  organizerEmail = seller?.email ?? null;

  const ics = buildBookingIcs({
    uid: `${b.id}@invoxai.io`,
    startIso: b.start_at as string,
    endIso: b.end_at as string,
    title,
    description: bt?.description ?? null,
    location: bt?.location ?? null,
    organizerEmail,
    attendeeEmail: (b.buyer_email as string) ?? null,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="booking-${b.id}.ics"`,
      "cache-control": "no-store",
    },
  });
}
