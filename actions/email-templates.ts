"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAILBOX_ROLES, type MailboxRole } from "@/lib/emails/routing";
import { sendViaSmtp } from "@/lib/emails/smtp";
import {
  BUILTIN_META,
  PLACEHOLDERS,
  GLOBAL_PLACEHOLDERS,
  SAMPLE_DATA,
  renderEmail,
  renderFromFields,
  invalidateTemplateCache,
} from "@/lib/emails/render";
import { DEFAULT_DRAFT } from "@/lib/emails/drafts";

export interface TemplateActionResult {
  ok: boolean;
  message?: string;
  data?: unknown;
}

export interface TemplateListItem {
  key: string;
  name: string;
  audience: string;
  role: string;
  live: boolean;
  isCustom: boolean;
  edited: boolean; // built-in with a saved override
  enabled: boolean;
  subject: string;
  body_html: string;
  use_shell: boolean;
  placeholders: string[];
}

interface Row {
  key: string;
  name: string;
  audience: string;
  role: string;
  subject: string;
  body_html: string;
  use_shell: boolean;
  is_custom: boolean;
  enabled: boolean;
}

async function readRows(): Promise<Map<string, Row>> {
  const admin = createAdminClient();
  const { data } = await admin.from("email_templates").select("*");
  const m = new Map<string, Row>();
  for (const r of (data ?? []) as Row[]) m.set(r.key, r);
  return m;
}

export async function listEmailTemplatesAction(): Promise<TemplateActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  let rows: Map<string, Row>;
  try {
    rows = await readRows();
  } catch {
    rows = new Map(); // table missing (pre-migration)
  }

  const items: TemplateListItem[] = [];

  // Built-ins (+ any saved overrides).
  for (const meta of BUILTIN_META) {
    const row = rows.get(meta.key);
    const draft = DEFAULT_DRAFT[meta.key] ?? { subject: "", body_html: "" };
    items.push({
      key: meta.key,
      name: meta.name,
      audience: meta.audience,
      role: row?.role || meta.role,
      live: meta.live,
      isCustom: false,
      edited: !!row,
      enabled: row ? row.enabled : true,
      subject: row?.subject || draft.subject,
      body_html: row?.body_html || draft.body_html,
      use_shell: row ? row.use_shell : true,
      placeholders: [...(PLACEHOLDERS[meta.key] ?? []), ...GLOBAL_PLACEHOLDERS],
    });
  }

  // Custom templates (DB only).
  for (const row of rows.values()) {
    if (!row.is_custom) continue;
    items.push({
      key: row.key,
      name: row.name || row.key,
      audience: row.audience || "Other",
      role: row.role || "noreply",
      live: true,
      isCustom: true,
      edited: true,
      enabled: row.enabled,
      subject: row.subject,
      body_html: row.body_html,
      use_shell: row.use_shell,
      placeholders: [...GLOBAL_PLACEHOLDERS],
    });
  }

  return { ok: true, data: items };
}

export interface SaveTemplateInput {
  key: string;
  name?: string;
  audience?: string;
  role?: string;
  subject: string;
  body_html: string;
  use_shell: boolean;
  enabled: boolean;
  is_custom: boolean;
}

function slugifyKey(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `custom_${s || "template"}`;
}

export async function saveEmailTemplateAction(
  input: SaveTemplateInput,
): Promise<TemplateActionResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  if (!input.subject.trim()) return { ok: false, message: "Subject is required" };
  if (!input.body_html.trim()) return { ok: false, message: "Body is required" };

  const role = (MAILBOX_ROLES as string[]).includes(input.role ?? "")
    ? (input.role as MailboxRole)
    : "noreply";

  // New custom template → derive a stable key from the name.
  const isNewCustom = input.is_custom && !input.key;
  const key = isNewCustom ? slugifyKey(input.name ?? "") : input.key;
  if (!key) return { ok: false, message: "Missing template key" };

  const admin = createAdminClient();
  const { error } = await admin.from("email_templates").upsert(
    {
      key,
      name: input.name ?? key,
      audience: input.audience ?? "Other",
      role,
      subject: input.subject,
      body_html: input.body_html,
      use_shell: input.use_shell,
      is_custom: input.is_custom,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, message: error.message };

  invalidateTemplateCache();
  await writeAuditLog({
    admin_id: adminId,
    action: "email_template.saved",
    target_type: "email_template",
    target_id: key,
    details: { is_custom: input.is_custom },
  });
  revalidatePath("/admin/email/templates");
  return { ok: true, data: { key } };
}

export async function resetEmailTemplateAction(
  key: string,
): Promise<TemplateActionResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  // Only built-ins reset (reverts to the code template). Refuse on customs.
  const { data: row } = await admin
    .from("email_templates")
    .select("is_custom")
    .eq("key", key)
    .maybeSingle();
  if (row?.is_custom) {
    return { ok: false, message: "Use Delete for custom templates" };
  }
  await admin.from("email_templates").delete().eq("key", key);
  invalidateTemplateCache();
  await writeAuditLog({
    admin_id: adminId,
    action: "email_template.reset",
    target_type: "email_template",
    target_id: key,
  });
  revalidatePath("/admin/email/templates");
  return { ok: true };
}

export async function deleteCustomTemplateAction(
  key: string,
): Promise<TemplateActionResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin
    .from("email_templates")
    .delete()
    .eq("key", key)
    .eq("is_custom", true);
  invalidateTemplateCache();
  await writeAuditLog({
    admin_id: adminId,
    action: "email_template.deleted",
    target_type: "email_template",
    target_id: key,
  });
  revalidatePath("/admin/email/templates");
  return { ok: true };
}

export async function previewTemplateAction(input: {
  key: string;
  subject: string;
  body_html: string;
  use_shell: boolean;
}): Promise<TemplateActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const built = await renderFromFields(
    { subject: input.subject, body_html: input.body_html, use_shell: input.use_shell },
    SAMPLE_DATA[input.key] ?? {},
  );
  return { ok: true, data: built };
}

export async function sendTemplateTestAction(
  key: string,
  to: string,
  role: string,
): Promise<TemplateActionResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!/.+@.+\..+/.test(to)) return { ok: false, message: "Enter a valid email" };

  const built = await renderEmail(key, SAMPLE_DATA[key] ?? {});
  const mailboxRole = (MAILBOX_ROLES as string[]).includes(role)
    ? (role as MailboxRole)
    : "noreply";
  const res = await sendViaSmtp({
    role: mailboxRole,
    to,
    subject: `[TEST] ${built.subject}`,
    html: built.html,
  });
  await writeAuditLog({
    admin_id: adminId,
    action: "email_template.test_sent",
    target_type: "email_template",
    target_id: key,
    details: { ok: res.ok, skipped: res.skipped ?? false },
  });
  if (res.skipped) return { ok: false, message: `The ${mailboxRole} mailbox isn't configured.` };
  if (!res.ok) return { ok: false, message: res.message ?? "Send failed" };
  return { ok: true, message: `Test sent to ${to}` };
}

const BROADCAST_CAP = 1000;

export async function broadcastTemplateAction(
  key: string,
  role: string,
  recipientsRaw: string,
): Promise<TemplateActionResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const admin = createAdminClient();
  let recipients: string[] = [];

  if (recipientsRaw.trim().toLowerCase() === "all-sellers") {
    const { data } = await admin
      .from("user_profiles")
      .select("email")
      .not("email", "is", null)
      .limit(BROADCAST_CAP);
    recipients = (data ?? [])
      .map((r) => (r as { email: string }).email)
      .filter(Boolean);
  } else {
    recipients = recipientsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /.+@.+\..+/.test(s))
      .slice(0, BROADCAST_CAP);
  }
  if (recipients.length === 0) return { ok: false, message: "No valid recipients" };

  // Render once (broadcast templates carry no per-recipient data).
  const built = await renderEmail(key, SAMPLE_DATA[key] ?? {});
  const mailboxRole = (MAILBOX_ROLES as string[]).includes(role)
    ? (role as MailboxRole)
    : "noreply";

  await writeAuditLog({
    admin_id: adminId,
    action: "email_template.broadcast",
    target_type: "email_template",
    target_id: key,
    details: { count: recipients.length },
  });

  // Fire-and-forget so the action returns promptly; the long-running process
  // finishes the sends. Best-effort per recipient.
  void (async () => {
    for (const to of recipients) {
      try {
        await sendViaSmtp({ role: mailboxRole, to, subject: built.subject, html: built.html });
      } catch {
        /* best-effort */
      }
    }
  })();

  return { ok: true, message: `Broadcasting to ${recipients.length} recipient(s)…` };
}
