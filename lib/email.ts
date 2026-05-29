// Thin Resend wrapper + the transactional templates we send today.
//
// All functions return ok:true even when Resend isn't configured — that lets
// callers (verify-payment, cron) treat email as best-effort without breaking
// the user-facing flow.

import { Resend } from "resend";

let cached: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new Resend(key);
  return cached;
}

function fromAddr(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "InvoxAI <onboarding@resend.dev>"
  );
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  message?: string;
  skipped?: boolean;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", {
      to: args.to,
      subject: args.subject,
    });
    return { ok: true, skipped: true };
  }
  try {
    const res = await resend.emails.send({
      from: fromAddr(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.reply_to,
    });
    if (res.error) return { ok: false, message: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ============================================================================
// Templates
// ============================================================================

const SHELL = (inner: string) => `
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
  <table cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px 28px 12px;font-weight:600">InvoxAI</td></tr>
    <tr><td style="padding:0 28px 24px">${inner}</td></tr>
    <tr><td style="padding:16px 28px;background:#f8f8f8;font-size:12px;color:#71717a">
      You're receiving this because you bought access via InvoxAI.
    </td></tr>
  </table>
</body></html>`;

export interface ExpiryEmailVars {
  buyerName?: string;
  groupName?: string;
  renewUrl?: string;
}

export function expiryEmail(vars: ExpiryEmailVars): {
  subject: string;
  html: string;
} {
  const hello = vars.buyerName ? `Hi ${vars.buyerName},` : "Hi,";
  const group = vars.groupName ?? "the VIP group";
  const renew = vars.renewUrl
    ? `<p style="margin:0 0 12px"><a href="${vars.renewUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Renew access</a></p>`
    : "";
  return {
    subject: `Your access to ${group} has expired`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">Your VIP access has expired</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Your access to <strong>${group}</strong> just ran out and you've been removed from the group.</p>
      ${renew}
      <p style="margin:0;color:#71717a;font-size:12px">If you renew, we'll send you a fresh invite link.</p>
    `),
  };
}

export interface ReminderEmailVars {
  buyerName?: string;
  groupName?: string;
  daysLeft: number;
  renewUrl?: string;
}

export function reminderEmail(vars: ReminderEmailVars): {
  subject: string;
  html: string;
} {
  const hello = vars.buyerName ? `Hi ${vars.buyerName},` : "Hi,";
  const group = vars.groupName ?? "the VIP group";
  const renew = vars.renewUrl
    ? `<p style="margin:0 0 12px"><a href="${vars.renewUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Renew now</a></p>`
    : "";
  return {
    subject: `${vars.daysLeft} day${vars.daysLeft === 1 ? "" : "s"} left — ${group}`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">Your VIP access ends in ${vars.daysLeft} day${vars.daysLeft === 1 ? "" : "s"}</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Heads up — your access to <strong>${group}</strong> ends soon. Renew now and we'll keep you in the room without interruption.</p>
      ${renew}
    `),
  };
}

export interface InviteEmailVars {
  buyerName?: string;
  groupName?: string;
  inviteLink: string;
}

export function inviteEmail(vars: InviteEmailVars): { subject: string; html: string } {
  const hello = vars.buyerName ? `Hi ${vars.buyerName},` : "Hi,";
  const group = vars.groupName ?? "the VIP group";
  return {
    subject: `Your invite to ${group}`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">Welcome 👋</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Tap the button below to join <strong>${group}</strong> on Telegram. The link is for you only and expires in 10 minutes.</p>
      <p style="margin:0 0 12px"><a href="${vars.inviteLink}" style="display:inline-block;background:#0088cc;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open in Telegram</a></p>
      <p style="margin:0;color:#71717a;font-size:12px;word-break:break-all">${vars.inviteLink}</p>
    `),
  };
}
