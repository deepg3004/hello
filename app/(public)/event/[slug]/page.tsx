// Public event page — /event/<slug> (apex + seller subdomain). One fixed
// date/time, capacity/seats-left, and a register form (free or paid).

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatSlotLabel } from "@/lib/booking";
import { formatINR } from "@/lib/utils";
import { EventClient } from "@/components/event/EventClient";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("booking_events")
    .select("title, description")
    .eq("slug", params.slug)
    .maybeSingle();
  return { title: ev?.title ?? "Event", description: ev?.description ?? undefined };
}

export default async function EventPage({ params }: Props) {
  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("booking_events")
    .select("id, slug, title, description, start_at, end_at, capacity, price, currency, location, active")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!ev || !ev.active) notFound();

  const { count } = await admin
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("booking_event_id", ev.id)
    .in("status", ["confirmed", "pending"]);
  const taken = count ?? 0;
  const seatsLeft = ev.capacity != null ? Math.max(0, ev.capacity - taken) : null;
  const isPast = new Date(ev.start_at).getTime() < Date.now();
  const soldOut = seatsLeft !== null && seatsLeft <= 0;
  const price = Number(ev.price ?? 0);

  return (
    <main className="mx-auto max-w-lg px-4 py-12 md:py-16">
      <div className="rounded-2xl border bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-sora text-2xl font-bold tracking-tight">{ev.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          🗓 {formatSlotLabel(ev.start_at)} (IST)
          {ev.location ? ` · 📍 ${ev.location}` : ""}
        </p>
        {ev.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700">{ev.description}</p>
        )}

        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <span className="text-lg font-bold">
            {price > 0 ? formatINR(Math.round(price * 100)) : "Free"}
          </span>
          {seatsLeft !== null && !isPast && (
            <span className="text-xs text-muted-foreground">
              {soldOut ? "Sold out" : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>

        <div className="mt-5">
          {isPast ? (
            <p className="text-sm text-muted-foreground">This event has ended.</p>
          ) : soldOut ? (
            <p className="text-sm font-medium text-rose-600">This event is sold out.</p>
          ) : (
            <EventClient
              slug={ev.slug}
              title={ev.title}
              price={price}
              currency={ev.currency ?? "INR"}
            />
          )}
        </div>
      </div>
    </main>
  );
}
