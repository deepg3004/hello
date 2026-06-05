"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

interface Result {
  ok: boolean;
  message?: string;
  id?: string;
}

export interface AvailabilityInput {
  weekday: number;
  start_min: number;
  end_min: number;
}

export interface BookingTypeInput {
  title: string;
  description?: string | null;
  duration_min: number;
  buffer_min?: number;
  price?: number;
  location?: string | null;
  availability: AvailabilityInput[];
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "booking"
  );
}

function cleanWindows(rows: AvailabilityInput[]): AvailabilityInput[] {
  return (rows ?? [])
    .filter(
      (w) =>
        Number.isFinite(w.weekday) &&
        w.weekday >= 0 &&
        w.weekday <= 6 &&
        w.end_min > w.start_min,
    )
    .map((w) => ({
      weekday: Math.floor(w.weekday),
      start_min: Math.max(0, Math.min(1440, Math.floor(w.start_min))),
      end_min: Math.max(0, Math.min(1440, Math.floor(w.end_min))),
    }));
}

export async function createBookingTypeAction(
  input: BookingTypeInput,
): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;
  if (!input.title?.trim()) return { ok: false, message: "Title required" };
  if (!input.duration_min || input.duration_min <= 0) {
    return { ok: false, message: "Duration must be greater than 0" };
  }

  const admin = createAdminClient();
  const slug = `${slugify(input.title)}-${nanoid(6)}`;

  const { data: bt, error } = await admin
    .from("booking_types")
    .insert({
      user_id: ctx.ownerId,
      slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      duration_min: Math.floor(input.duration_min),
      buffer_min: Math.max(0, Math.floor(input.buffer_min ?? 0)),
      price: Math.max(0, Number(input.price ?? 0)),
      location: input.location?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !bt) return { ok: false, message: error?.message ?? "Failed" };

  const windows = cleanWindows(input.availability);
  if (windows.length > 0) {
    await admin.from("booking_availability").insert(
      windows.map((w) => ({ ...w, booking_type_id: bt.id })),
    );
  }

  revalidatePath("/dashboard/booking");
  return { ok: true, id: bt.id };
}

export async function updateBookingTypeAction(
  id: string,
  input: BookingTypeInput & { active?: boolean },
): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("booking_types")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!owned || owned.user_id !== ctx.ownerId) {
    return { ok: false, message: "Not found" };
  }

  const { error } = await admin
    .from("booking_types")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      duration_min: Math.floor(input.duration_min),
      buffer_min: Math.max(0, Math.floor(input.buffer_min ?? 0)),
      price: Math.max(0, Number(input.price ?? 0)),
      location: input.location?.trim() || null,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  // Replace availability windows wholesale.
  await admin.from("booking_availability").delete().eq("booking_type_id", id);
  const windows = cleanWindows(input.availability);
  if (windows.length > 0) {
    await admin.from("booking_availability").insert(
      windows.map((w) => ({ ...w, booking_type_id: id })),
    );
  }

  revalidatePath("/dashboard/booking");
  return { ok: true, id };
}

export async function deleteBookingTypeAction(id: string): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("booking_types")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/booking");
  return { ok: true };
}

export async function rescheduleBookingAction(
  id: string,
  newStartIso: string,
): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const wanted = (() => {
    const t = Date.parse(newStartIso);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  })();
  if (!wanted) return { ok: false, message: "Invalid date/time" };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, seller_user_id, booking_type_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!booking || booking.seller_user_id !== ctx.ownerId) {
    return { ok: false, message: "Booking not found" };
  }
  if (booking.status === "cancelled") {
    return { ok: false, message: "Can't reschedule a cancelled booking" };
  }

  const { data: bt } = await admin
    .from("booking_types")
    .select("id, duration_min")
    .eq("id", booking.booking_type_id)
    .maybeSingle();
  if (!bt) return { ok: false, message: "Booking type missing" };

  // Seller-initiated reschedule = an override, so it's not constrained to the
  // public availability grid; we only require a future time. The bookings
  // (booking_type_id, start_at) unique index still blocks a double-book.
  if (Date.parse(wanted) <= Date.now()) {
    return { ok: false, message: "Pick a time in the future." };
  }

  const start = new Date(wanted);
  const end = new Date(start.getTime() + bt.duration_min * 60_000);
  const { error } = await admin
    .from("bookings")
    .update({ start_at: start.toISOString(), end_at: end.toISOString() })
    .eq("id", id);
  if (error) {
    // Unique-index violation = the slot was grabbed in between.
    return { ok: false, message: "That slot was just taken. Pick another." };
  }

  revalidatePath("/dashboard/booking");
  return { ok: true, id };
}

export async function cancelBookingAction(id: string): Promise<Result> {
  const actor = await requireActor("booking.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("seller_user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/booking");
  return { ok: true };
}
