"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { slugify } from "@/lib/templates/utils";

interface Result {
  ok: boolean;
  message?: string;
  id?: string;
  slug?: string;
}

export interface EventInput {
  title: string;
  description?: string | null;
  start_iso: string;
  end_iso: string;
  capacity?: number | null;
  price?: number;
  location?: string | null;
}

function parseWindow(startIso: string, endIso: string): { start: string; end: string } | null {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return { start: new Date(s).toISOString(), end: new Date(e).toISOString() };
}

function normCapacity(c: number | null | undefined): number | null {
  if (c === null || c === undefined || Number(c) <= 0) return null;
  return Math.floor(Number(c));
}

export async function createEventAction(input: EventInput): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  if (!input.title?.trim()) return { ok: false, message: "Title is required" };
  const win = parseWindow(input.start_iso, input.end_iso);
  if (!win) return { ok: false, message: "End time must be after the start time." };

  const admin = createAdminClient();
  const slug = `${slugify(input.title) || "event"}-${nanoid(6)}`;
  const { data, error } = await admin
    .from("booking_events")
    .insert({
      user_id: ctx.ownerId,
      slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_at: win.start,
      end_at: win.end,
      capacity: normCapacity(input.capacity),
      price: Math.max(0, Number(input.price ?? 0)),
      location: input.location?.trim() || null,
    })
    .select("id, slug")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Failed" };

  revalidatePath("/dashboard/booking/events");
  return { ok: true, id: data.id, slug: data.slug };
}

export async function updateEventAction(
  id: string,
  input: EventInput & { active?: boolean },
): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  if (!input.title?.trim()) return { ok: false, message: "Title is required" };
  const win = parseWindow(input.start_iso, input.end_iso);
  if (!win) return { ok: false, message: "End time must be after the start time." };

  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("booking_events")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!owned || owned.user_id !== ctx.ownerId) {
    return { ok: false, message: "Event not found" };
  }

  const { error } = await admin
    .from("booking_events")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_at: win.start,
      end_at: win.end,
      capacity: normCapacity(input.capacity),
      price: Math.max(0, Number(input.price ?? 0)),
      location: input.location?.trim() || null,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/booking/events");
  return { ok: true, id };
}

export async function deleteEventAction(id: string): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("booking_events")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/booking/events");
  return { ok: true };
}

/** Seller cancels an attendee's registration (frees a capacity seat). */
export async function cancelRegistrationAction(registrationId: string): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("event_registrations")
    .select("id, booking_event_id, booking_events!inner(user_id)")
    .eq("id", registrationId)
    .maybeSingle();
  const bj = reg
    ? (reg as unknown as { booking_events: { user_id: string } | { user_id: string }[] }).booking_events
    : null;
  const ev = Array.isArray(bj) ? bj[0] : bj;
  if (!reg || ev?.user_id !== ctx.ownerId) {
    return { ok: false, message: "Registration not found" };
  }

  await admin
    .from("event_registrations")
    .update({ status: "cancelled" })
    .eq("id", registrationId);

  revalidatePath("/dashboard/booking/events");
  return { ok: true };
}
