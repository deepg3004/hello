"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export interface LearnResult {
  ok: boolean;
  message?: string;
  id?: string;
}

export type LearnSection = "featured" | "use_invoxai" | "niche";

export interface LearnVideoInput {
  id?: string;
  section: LearnSection;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_label?: string;
  badge_label?: string;
  cta_label?: string;
  is_published?: boolean;
}

function revalidateLearn() {
  revalidatePath("/admin/learn");
  revalidatePath("/dashboard/learn");
}

export async function upsertLearnVideoAction(
  input: LearnVideoInput,
): Promise<LearnResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!input.title.trim()) return { ok: false, message: "Title is required" };

  const admin = createAdminClient();
  const row = {
    section: input.section,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    video_url: input.video_url?.trim() || null,
    thumbnail_url: input.thumbnail_url?.trim() || null,
    duration_label: input.duration_label?.trim() || null,
    badge_label: input.badge_label?.trim() || null,
    cta_label: input.cta_label?.trim() || null,
    is_published: input.is_published ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await admin
      .from("learn_videos")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, message: error.message };
    await writeAuditLog({
      admin_id: adminId,
      action: "learn.video_updated",
      target_type: "learn_video",
      target_id: input.id,
      details: { section: input.section },
    });
    revalidateLearn();
    return { ok: true, id: input.id };
  }

  // New row → append to the end of its section.
  const { data: last } = await admin
    .from("learn_videos")
    .select("sort_order")
    .eq("section", input.section)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;

  const { data, error } = await admin
    .from("learn_videos")
    .insert({ ...row, sort_order })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed" };

  await writeAuditLog({
    admin_id: adminId,
    action: "learn.video_created",
    target_type: "learn_video",
    target_id: data.id,
    details: { section: input.section },
  });
  revalidateLearn();
  return { ok: true, id: data.id };
}

export async function deleteLearnVideoAction(id: string): Promise<LearnResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("learn_videos").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  await writeAuditLog({
    admin_id: adminId,
    action: "learn.video_deleted",
    target_type: "learn_video",
    target_id: id,
  });
  revalidateLearn();
  return { ok: true };
}

/** Swap a video with its neighbour in the same section (sort_order reorder). */
export async function reorderLearnVideoAction(
  id: string,
  direction: "up" | "down",
): Promise<LearnResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("learn_videos")
    .select("id, section, sort_order")
    .eq("id", id)
    .single();
  if (!current) return { ok: false, message: "Not found" };

  const { data: rows } = await admin
    .from("learn_videos")
    .select("id, sort_order")
    .eq("section", current.section)
    .order("sort_order", { ascending: true });
  if (!rows) return { ok: false, message: "No rows" };

  const idx = rows.findIndex((r) => r.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rows.length) return { ok: true }; // edge — no-op

  const a = rows[idx]!;
  const b = rows[swapIdx]!;
  await Promise.all([
    admin.from("learn_videos").update({ sort_order: b.sort_order }).eq("id", a.id),
    admin.from("learn_videos").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  revalidateLearn();
  return { ok: true };
}
