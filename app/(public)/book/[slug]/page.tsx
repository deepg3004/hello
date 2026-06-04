// /book/[slug] — public booking page. Shows available slots for a seller's
// booking type and lets a visitor reserve one (free → instant; paid → seller
// gateway checkout). Resolves on apex + seller subdomains (middleware allow-list).

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlots, type AvailabilityWindow } from "@/lib/booking";
import { BookingClient } from "@/components/booking/BookingClient";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
}: {
  params: { slug: string };
}) {
  const admin = createAdminClient();
  const { data: bt } = await admin
    .from("booking_types")
    .select(
      "id, title, description, duration_min, buffer_min, price, currency, location, active",
    )
    .eq("slug", params.slug)
    .maybeSingle();
  if (!bt || !bt.active) notFound();

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

  return (
    <main className="mx-auto max-w-xl px-4 py-10 md:py-14">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold tracking-tight md:text-3xl">
          {bt.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bt.duration_min} min
          {bt.location ? ` · ${bt.location}` : ""}
          {Number(bt.price) > 0
            ? ` · ₹${Number(bt.price).toLocaleString("en-IN")}`
            : " · Free"}
        </p>
        {bt.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">
            {bt.description}
          </p>
        )}
      </div>

      <BookingClient
        slug={params.slug}
        title={bt.title}
        price={Number(bt.price ?? 0)}
        slots={slots}
      />
    </main>
  );
}
