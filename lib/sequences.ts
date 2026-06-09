// Email-sequence engine: enrollment (on a trigger) + the scheduler that sends
// each due step and advances the enrollment. Server-only; uses the service-role
// admin client. Best-effort everywhere — never throws into a checkout/lead path.

import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;
export type SequenceTrigger = "lead_created" | "purchase" | "manual";

function subst(t: string, name: string | null, email: string): string {
  return (t || "")
    .replace(/\{\{\s*name\s*\}\}/gi, name || "there")
    .replace(/\{\{\s*email\s*\}\}/gi, email || "");
}

/**
 * Enroll a contact into every ACTIVE sequence for a seller matching `trigger`.
 * Idempotent per (sequence, email) via the unique index. No-op when the seller
 * has no matching sequences or a sequence has no steps.
 */
export async function enrollInSequences(
  args: { sellerUserId: string; trigger: SequenceTrigger; email: string; name?: string | null },
  admin: DB,
): Promise<void> {
  try {
    const email = args.email?.trim().toLowerCase();
    if (!email || !args.sellerUserId) return;

    const { data: seqs } = await admin
      .from("email_sequences")
      .select("id")
      .eq("user_id", args.sellerUserId)
      .eq("trigger", args.trigger)
      .eq("active", true);
    if (!seqs || seqs.length === 0) return;

    for (const seq of seqs) {
      const { data: step0 } = await admin
        .from("email_sequence_steps")
        .select("delay_hours")
        .eq("sequence_id", seq.id)
        .order("step_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!step0) continue; // empty sequence
      const nextSend = new Date(
        Date.now() + Math.max(0, Number(step0.delay_hours ?? 0)) * 3600_000,
      ).toISOString();
      // Ignore unique-violation (already enrolled) — that's the desired dedup.
      await admin.from("sequence_enrollments").insert({
        sequence_id: seq.id,
        user_id: args.sellerUserId,
        contact_email: email,
        contact_name: args.name ?? null,
        current_step: 0,
        status: "active",
        next_send_at: nextSend,
      });
    }
  } catch (e) {
    console.error("[sequences] enroll failed", e);
  }
}

/**
 * Send every due step (next_send_at <= now, status active) and advance the
 * enrollment to the next step or mark it done. Called by the cron.
 */
export async function processDueEnrollments(admin: DB, limit = 200): Promise<{ sent: number; processed: number }> {
  const now = new Date().toISOString();
  const { data: due } = await admin
    .from("sequence_enrollments")
    .select("id, sequence_id, user_id, contact_email, contact_name, current_step")
    .eq("status", "active")
    .lte("next_send_at", now)
    .limit(limit);
  const rows = (due ?? []) as Array<{
    id: string;
    sequence_id: string;
    user_id: string;
    contact_email: string;
    contact_name: string | null;
    current_step: number;
  }>;
  if (rows.length === 0) return { sent: 0, processed: 0 };

  let sent = 0;
  for (const e of rows) {
    const { data: stepsRaw } = await admin
      .from("email_sequence_steps")
      .select("delay_hours, subject, body")
      .eq("sequence_id", e.sequence_id)
      .order("step_order", { ascending: true });
    const steps = (stepsRaw ?? []) as Array<{ delay_hours: number; subject: string; body: string }>;
    const step = steps[e.current_step];

    if (!step) {
      await admin.from("sequence_enrollments").update({ status: "done" }).eq("id", e.id);
      continue;
    }

    try {
      const { sendEmail } = await import("@/lib/email");
      const { SHELL, escapeHtml } = await import("@/lib/emails/layout");
      const subject = subst(step.subject, e.contact_name, e.contact_email) || "A message for you";
      const bodyHtml = escapeHtml(subst(step.body, e.contact_name, e.contact_email));
      await sendEmail({
        to: e.contact_email,
        sellerId: e.user_id,
        role: "noreply",
        subject,
        html: SHELL(`<p style="white-space:pre-wrap;line-height:1.6">${bodyHtml}</p>`, { preheader: subject }),
      });
      sent++;
    } catch (err) {
      console.error("[sequences] send failed", err);
    }

    const nextIdx = e.current_step + 1;
    if (nextIdx >= steps.length) {
      await admin.from("sequence_enrollments").update({ status: "done", current_step: nextIdx }).eq("id", e.id);
    } else {
      const nextAt = new Date(
        Date.now() + Math.max(0, Number(steps[nextIdx]!.delay_hours ?? 0)) * 3600_000,
      ).toISOString();
      await admin.from("sequence_enrollments").update({ current_step: nextIdx, next_send_at: nextAt }).eq("id", e.id);
    }
  }
  return { sent, processed: rows.length };
}
