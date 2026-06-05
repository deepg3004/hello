// GET /api/events/[id]/ics — downloadable calendar invite for an event
// registration (the registration UUID is the capability). PII deliberately
// omitted (no ORGANIZER/ATTENDEE), like the 1:1 booking .ics.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingIcs } from "@/lib/booking-ics";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("event_registrations")
    .select("id, status, booking_events!inner(title, description, start_at, end_at, location)")
    .eq("id", params.id)
    .maybeSingle();
  if (!reg || reg.status === "cancelled") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  type Ev = { title: string; description: string | null; start_at: string; end_at: string; location: string | null };
  const bj = (reg as unknown as { booking_events: Ev | Ev[] }).booking_events;
  const ev = Array.isArray(bj) ? bj[0] : bj;

  const ics = buildBookingIcs({
    uid: `${reg.id}@invoxai.io`,
    startIso: ev.start_at,
    endIso: ev.end_at,
    title: ev.title,
    description: ev.description,
    location: ev.location,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="event-${reg.id}.ics"`,
      "cache-control": "no-store",
    },
  });
}
