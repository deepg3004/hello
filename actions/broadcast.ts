"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, writeAuditLog } from "@/lib/admin/audit";
import { createNotifications } from "@/lib/notifications/create";

interface Result {
  ok: boolean;
  message?: string;
  sent?: number;
}

/**
 * Post an in-app announcement (the bell) to every recipient in the chosen
 * audience. In-app only — no email blast. Admin-only, audit-logged. Inserts in
 * chunks so a large platform doesn't overflow a single insert.
 */
export async function sendBroadcastAction(input: {
  title: string;
  body?: string;
  link?: string;
  audience: "sellers" | "admins";
}): Promise<Result> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { ok: false, message: "Admin only" };
  }

  const title = input.title?.trim();
  if (!title) return { ok: false, message: "Title is required." };
  const link = input.link?.trim();
  if (link && !/^\/[\w\-/]*/.test(link) && !/^https?:\/\//i.test(link)) {
    return { ok: false, message: "Link must be a relative path or http(s) URL." };
  }

  const admin = createAdminClient();
  let query = admin.from("user_profiles").select("id");
  query =
    input.audience === "admins"
      ? query.eq("is_admin", true)
      : query.is("suspended_at", null); // sellers = all non-suspended accounts

  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };
  const ids = (data ?? []).map((u) => u.id as string).filter(Boolean);
  if (ids.length === 0) return { ok: false, message: "No recipients in that audience." };

  const rows = ids.map((id) => ({
    userId: id,
    type: "broadcast",
    title,
    body: input.body?.trim() || null,
    link: link || null,
  }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await createNotifications(rows.slice(i, i + CHUNK), admin);
  }

  await writeAuditLog({
    admin_id: adminId,
    action: "broadcast.send",
    details: { audience: input.audience, count: ids.length, title },
  });

  revalidatePath("/admin/broadcast");
  return { ok: true, sent: ids.length };
}
