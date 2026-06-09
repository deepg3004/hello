"use server";

// Seller CRUD for email sequences + their steps. Owner-scoped via requireActor
// (marketing capability) + ctx.ownerId.

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import type { SequenceTrigger } from "@/lib/sequences";

interface Result {
  ok: boolean;
  message?: string;
  id?: string;
}

export async function createSequenceAction(input: {
  name: string;
  trigger: SequenceTrigger;
}): Promise<Result> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_sequences")
    .insert({
      user_id: actor.ctx.ownerId,
      name: input.name?.trim() || "Untitled sequence",
      trigger: input.trigger,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/marketing/sequences");
  return { ok: true, id: data.id };
}

export async function updateSequenceAction(input: {
  id: string;
  name?: string;
  trigger?: SequenceTrigger;
  active?: boolean;
}): Promise<Result> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.name === "string") patch.name = input.name.trim() || "Untitled sequence";
  if (input.trigger) patch.trigger = input.trigger;
  if (typeof input.active === "boolean") patch.active = input.active;

  const admin = createAdminClient();
  const { error } = await admin
    .from("email_sequences")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", actor.ctx.ownerId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/marketing/sequences");
  return { ok: true };
}

export async function deleteSequenceAction(id: string): Promise<Result> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_sequences")
    .delete()
    .eq("id", id)
    .eq("user_id", actor.ctx.ownerId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/marketing/sequences");
  return { ok: true };
}

/** Replace a sequence's steps (simplest reliable editing — delete + re-insert). */
export async function saveStepsAction(input: {
  sequenceId: string;
  steps: Array<{ delay_hours: number; subject: string; body: string }>;
}): Promise<Result> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const admin = createAdminClient();

  // Ownership guard: the sequence must belong to the acting owner.
  const { data: seq } = await admin
    .from("email_sequences")
    .select("id")
    .eq("id", input.sequenceId)
    .eq("user_id", actor.ctx.ownerId)
    .maybeSingle();
  if (!seq) return { ok: false, message: "Sequence not found" };

  await admin.from("email_sequence_steps").delete().eq("sequence_id", input.sequenceId);
  const rows = (input.steps ?? [])
    .filter((s) => (s.subject?.trim() || s.body?.trim()))
    .map((s, i) => ({
      sequence_id: input.sequenceId,
      step_order: i,
      delay_hours: Math.max(0, Math.round(Number(s.delay_hours) || 0)),
      subject: s.subject?.trim() || "",
      body: s.body?.trim() || "",
    }));
  if (rows.length > 0) {
    const { error } = await admin.from("email_sequence_steps").insert(rows);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/dashboard/marketing/sequences");
  return { ok: true };
}
