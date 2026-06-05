"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { normalizeTags } from "@/lib/leads";
import { sendEmail } from "@/lib/email";

export interface LeadActionResult {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

async function requireSeller(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const actor = await requireActor("leads.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  return { ok: true, userId: actor.ctx.ownerId };
}

async function ownsLead(adminClient: ReturnType<typeof createAdminClient>, leadId: string, userId: string): Promise<boolean> {
  const { data } = await adminClient
    .from("lead_captures")
    .select("seller_user_id")
    .eq("id", leadId)
    .single();
  return data?.seller_user_id === userId;
}

// ---- Tag management --------------------------------------------------------

export async function addLeadTagsAction(
  leadId: string,
  tags: string[],
): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  if (!(await ownsLead(admin, leadId, auth.userId))) {
    return { ok: false, message: "Not allowed" };
  }
  const { data: current } = await admin
    .from("lead_captures")
    .select("tags")
    .eq("id", leadId)
    .single();
  const merged = normalizeTags([...(current?.tags ?? []), ...tags]);
  await admin.from("lead_captures").update({ tags: merged }).eq("id", leadId);
  revalidatePath("/dashboard/leads");
  return { ok: true, data: { tags: merged } };
}

export async function removeLeadTagAction(
  leadId: string,
  tag: string,
): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  if (!(await ownsLead(admin, leadId, auth.userId))) {
    return { ok: false, message: "Not allowed" };
  }
  const { data: current } = await admin
    .from("lead_captures")
    .select("tags")
    .eq("id", leadId)
    .single();
  const next = (current?.tags ?? []).filter((t: string) => t !== tag);
  await admin.from("lead_captures").update({ tags: next }).eq("id", leadId);
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

// ---- Notes ------------------------------------------------------------------

export interface LeadNote {
  body: string;
  by: string;
  at: string;
}

export async function addLeadNoteAction(
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  if (!body.trim()) return { ok: false, message: "Note required" };
  const admin = createAdminClient();
  if (!(await ownsLead(admin, leadId, auth.userId))) {
    return { ok: false, message: "Not allowed" };
  }
  const { data: current } = await admin
    .from("lead_captures")
    .select("notes")
    .eq("id", leadId)
    .single();
  const notes = Array.isArray(current?.notes) ? (current!.notes as LeadNote[]) : [];
  notes.push({ body: body.trim(), by: auth.userId, at: new Date().toISOString() });
  await admin.from("lead_captures").update({ notes }).eq("id", leadId);
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

// ---- Bulk delete -----------------------------------------------------------

export async function deleteLeadsAction(ids: string[]): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  if (ids.length === 0) return { ok: true };

  const admin = createAdminClient();
  // Scope deletion to leads owned by this seller.
  const { error } = await admin
    .from("lead_captures")
    .delete()
    .in("id", ids)
    .eq("seller_user_id", auth.userId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

// ---- Manual / broadcast email ---------------------------------------------

export async function sendManualEmailAction(
  leadId: string,
  subject: string,
  body: string,
): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  if (!subject.trim() || !body.trim()) {
    return { ok: false, message: "Subject and body required" };
  }
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("lead_captures")
    .select("email, seller_user_id")
    .eq("id", leadId)
    .single();
  if (!lead || lead.seller_user_id !== auth.userId) {
    return { ok: false, message: "Not allowed" };
  }
  const r = await sendEmail({
    to: lead.email,
    role: "buyer",
    subject: subject.trim(),
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap;color:#18181b">${body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</div>`,
  });
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}

export async function broadcastEmailAction(
  leadIds: string[],
  subject: string,
  body: string,
): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  if (leadIds.length === 0) return { ok: false, message: "No leads selected" };
  if (!subject.trim() || !body.trim()) {
    return { ok: false, message: "Subject and body required" };
  }
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("lead_captures")
    .select("id, email")
    .in("id", leadIds)
    .eq("seller_user_id", auth.userId);

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap;color:#18181b">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</div>`;

  let sent = 0;
  for (const row of rows ?? []) {
    const r = await sendEmail({
      to: row.email,
      role: "buyer",
      subject: subject.trim(),
      html,
    });
    if (r.ok) sent++;
  }
  return { ok: true, data: { sent } };
}

// ---- Lead magnet upload ----------------------------------------------------

export interface UploadResult extends LeadActionResult {
  data?: { path: string; name: string; size: number; mime: string };
}

/**
 * Server action that uploads a lead-magnet file to Supabase Storage and writes
 * its meta into pages.page_config.lead_magnet.
 *
 * Called from <LeadMagnetUpload /> with FormData containing `file` + `pageId`.
 */
export async function uploadLeadMagnetAction(formData: FormData): Promise<UploadResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;

  const pageId = (formData.get("pageId") ?? "") as string;
  const file = formData.get("file");
  if (!pageId || !(file instanceof File)) {
    return { ok: false, message: "pageId and file are required" };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { ok: false, message: "File too large (50 MB max)" };
  }

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, page_config")
    .eq("id", pageId)
    .single();
  if (!page || page.user_id !== auth.userId) {
    return { ok: false, message: "Not allowed" };
  }

  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 100);
  const path = `${auth.userId}/${pageId}/${Date.now()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("lead-magnets")
    .upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (upErr) return { ok: false, message: upErr.message };

  const meta = {
    path,
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
    uploaded_at: new Date().toISOString(),
  };

  const merged = {
    ...((page.page_config as Record<string, unknown>) ?? {}),
    lead_magnet: meta,
  };
  await admin
    .from("pages")
    .update({ page_config: merged })
    .eq("id", pageId);

  revalidatePath(`/dashboard/pages/${pageId}/edit`);
  return { ok: true, data: meta };
}

export async function removeLeadMagnetAction(pageId: string): Promise<LeadActionResult> {
  const auth = await requireSeller();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, page_config")
    .eq("id", pageId)
    .single();
  if (!page || page.user_id !== auth.userId) {
    return { ok: false, message: "Not allowed" };
  }
  const cfg = ((page.page_config as Record<string, unknown>) ?? {}) as {
    lead_magnet?: { path?: string };
  };
  if (cfg.lead_magnet?.path) {
    await admin.storage.from("lead-magnets").remove([cfg.lead_magnet.path]);
  }
  const merged = { ...(page.page_config as Record<string, unknown>) };
  delete (merged as { lead_magnet?: unknown }).lead_magnet;
  await admin.from("pages").update({ page_config: merged }).eq("id", pageId);
  revalidatePath(`/dashboard/pages/${pageId}/edit`);
  return { ok: true };
}
