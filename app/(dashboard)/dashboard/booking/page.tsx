// /dashboard/booking — manage booking types (availability, price) + see upcoming
// bookings. Free (price 0) or paid (seller gateway) per type.

import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  BookingManager,
  type BookingTypeData,
  type UpcomingBooking,
} from "@/components/dashboard/booking/BookingManager";
import {
  EventManager,
  type EventRow,
  type EventRegistration,
} from "@/components/dashboard/booking/EventManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Booking" };

export default async function BookingDashboardPage() {
  const ctx = await requirePageActor("booking.view", "/dashboard/booking");

  const admin = createAdminClient();
  const [{ data: types }, { data: profile }] = await Promise.all([
    admin
      .from("booking_types")
      .select(
        "id, slug, title, description, duration_min, buffer_min, price, location, active, booking_availability(weekday, start_min, end_min)",
      )
      .eq("user_id", ctx.ownerId)
      .order("created_at", { ascending: false }),
    admin.from("user_profiles").select("subdomain").eq("id", ctx.ownerId).maybeSingle(),
  ]);

  const typeIds = (types ?? []).map((t) => t.id);
  const { data: bookingsRaw } = typeIds.length
    ? await admin
        .from("bookings")
        .select("id, booking_type_id, buyer_name, buyer_email, start_at, status, amount")
        .eq("seller_user_id", ctx.ownerId)
        .in("status", ["confirmed", "pending"])
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(100)
    : { data: [] };

  const titleById = new Map((types ?? []).map((t) => [t.id, t.title]));

  const bookingTypes: BookingTypeData[] = (types ?? []).map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    duration_min: t.duration_min,
    buffer_min: t.buffer_min,
    price: Number(t.price ?? 0),
    location: t.location,
    active: t.active,
    availability: (
      (t.booking_availability ?? []) as Array<{
        weekday: number;
        start_min: number;
        end_min: number;
      }>
    ).map((w) => ({ weekday: w.weekday, start_min: w.start_min, end_min: w.end_min })),
  }));

  const upcoming: UpcomingBooking[] = (bookingsRaw ?? []).map((b) => ({
    id: b.id,
    title: titleById.get(b.booking_type_id) ?? "Booking",
    buyer: b.buyer_name || b.buyer_email,
    start_at: b.start_at,
    status: b.status,
    amount: Number(b.amount ?? 0),
  }));

  // Group events + their registrations.
  const { data: eventsRaw } = await admin
    .from("booking_events")
    .select("id, slug, title, description, start_at, end_at, capacity, price, location, active")
    .eq("user_id", ctx.ownerId)
    .order("start_at", { ascending: true });
  const eventIds = (eventsRaw ?? []).map((e) => e.id);
  const { data: regsRaw } = eventIds.length
    ? await admin
        .from("event_registrations")
        .select("id, booking_event_id, buyer_name, buyer_email, status")
        .in("booking_event_id", eventIds)
    : { data: [] };
  const regsByEvent = new Map<string, EventRegistration[]>();
  for (const r of (regsRaw ?? []) as Array<{
    id: string;
    booking_event_id: string;
    buyer_name: string | null;
    buyer_email: string;
    status: string;
  }>) {
    const arr = regsByEvent.get(r.booking_event_id) ?? [];
    arr.push({ id: r.id, name: r.buyer_name, email: r.buyer_email, status: r.status });
    regsByEvent.set(r.booking_event_id, arr);
  }
  const events: EventRow[] = (eventsRaw ?? []).map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    start_at: e.start_at,
    end_at: e.end_at,
    capacity: e.capacity,
    price: Number(e.price ?? 0),
    location: e.location,
    active: e.active,
    registrations: regsByEvent.get(e.id) ?? [],
  }));

  const bookingBase = profile?.subdomain
    ? `https://${profile.subdomain}.${platformRootDomain()}/book/`
    : `https://app.${platformRootDomain()}/book/`;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Booking"
        blurb="Offer 1:1 calls, consults or sessions. Set your weekly availability — buyers pick a slot (free or paid)."
        gradient="from-fuchsia-600 via-purple-600 to-indigo-600"
      />
      <BookingManager
        bookingTypes={bookingTypes}
        upcoming={upcoming}
        bookingBase={bookingBase}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group events</CardTitle>
          <CardDescription>
            One fixed date/time, many attendees up to a capacity (workshop,
            webinar, class). Free or paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventManager events={events} bookingBase={bookingBase} />
        </CardContent>
      </Card>
    </div>
  );
}
