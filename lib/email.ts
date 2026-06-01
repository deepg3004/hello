// Thin Resend wrapper + the transactional templates we send today.
//
// All functions return ok:true even when Resend isn't configured — that lets
// callers (verify-payment, cron) treat email as best-effort without breaking
// the user-facing flow.

import { Resend } from "resend";

import { sendViaSmtp, getAdminBcc, type MailboxRole } from "@/lib/emails/smtp";

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
  /** Resend tags — used by the open-tracking webhook to disambiguate which
   *  recovery email a `email.opened` event belongs to. */
  tags?: Array<{ name: string; value: string }>;
  /** Which Gmail mailbox to send from (defaults to the noreply fallback).
   *  Sends carrying open-tracking `tags` bypass SMTP to keep Resend tracking. */
  role?: MailboxRole;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  message?: string;
  skipped?: boolean;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  // Gmail SMTP first — unless the send carries open-tracking tags (recovery),
  // which must go through Resend to keep the `email.opened` webhook working.
  if (!args.tags?.length) {
    const smtp = await sendViaSmtp({
      role: args.role ?? "noreply",
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.reply_to,
    });
    if (smtp.ok) return { ok: true, id: smtp.id };
    if (!smtp.skipped) {
      console.warn("[email] SMTP send failed, falling back to Resend", {
        to: args.to,
        subject: args.subject,
        message: smtp.message,
      });
    }
  }

  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", {
      to: args.to,
      subject: args.subject,
    });
    return { ok: true, skipped: true };
  }
  const bcc = await getAdminBcc();
  try {
    const res = await resend.emails.send({
      from: fromAddr(),
      to: args.to,
      bcc: bcc && bcc !== args.to ? bcc : undefined,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.reply_to,
      tags: args.tags,
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

// ============================================================================
// Lead-magnet / CRM templates
// ============================================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ConfirmationEmailVars {
  leadName?: string;
  subject?: string;
  body?: string;
  pageTitle?: string;
}

export function confirmationEmail(vars: ConfirmationEmailVars): {
  subject: string;
  html: string;
} {
  const hello = vars.leadName ? `Hi ${vars.leadName},` : "Hi,";
  const body =
    vars.body ??
    `Thanks for signing up. We've got your details and you'll hear from us soon.`;
  return {
    subject:
      vars.subject ??
      `Thanks for signing up${vars.pageTitle ? ` — ${vars.pageTitle}` : ""}`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">You're in</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5;white-space:pre-wrap">${escapeHtml(body)}</p>
    `),
  };
}

export interface MagnetDeliveryEmailVars {
  leadName?: string;
  pageTitle?: string;
  downloadUrl: string;
  expiresLabel?: string;
}

export function leadMagnetDeliveryEmail(vars: MagnetDeliveryEmailVars): {
  subject: string;
  html: string;
} {
  const hello = vars.leadName ? `Hi ${vars.leadName},` : "Hi,";
  return {
    subject: `Your download — ${vars.pageTitle ?? "InvoxAI"}`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">Here's your download</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Tap the button below to grab your file.</p>
      <p style="margin:0 0 12px"><a href="${vars.downloadUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Download now</a></p>
      <p style="margin:0;color:#71717a;font-size:12px">${vars.expiresLabel ?? "Link expires in 7 days."}</p>
    `),
  };
}

export interface NewLeadEmailVars {
  sellerName?: string;
  leadName?: string;
  leadEmail: string;
  leadPhone?: string;
  pageTitle?: string;
  customFields?: Record<string, unknown>;
  crmUrl?: string;
}

export function newLeadNotificationEmail(vars: NewLeadEmailVars): {
  subject: string;
  html: string;
} {
  const hello = vars.sellerName ? `Hi ${vars.sellerName},` : "Hi,";
  const customs = Object.entries(vars.customFields ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#71717a">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");

  return {
    subject: `New lead from ${vars.pageTitle ?? "your page"}`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">New lead captured</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Name</td><td style="padding:4px 0">${escapeHtml(vars.leadName ?? "—")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Email</td><td style="padding:4px 0">${escapeHtml(vars.leadEmail)}</td></tr>
        ${vars.leadPhone ? `<tr><td style="padding:4px 12px 4px 0;color:#71717a">Phone</td><td style="padding:4px 0">${escapeHtml(vars.leadPhone)}</td></tr>` : ""}
        ${vars.pageTitle ? `<tr><td style="padding:4px 12px 4px 0;color:#71717a">Page</td><td style="padding:4px 0">${escapeHtml(vars.pageTitle)}</td></tr>` : ""}
        ${customs}
      </table>
      ${vars.crmUrl ? `<p style="margin:0 0 12px"><a href="${vars.crmUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:600">Open in CRM</a></p>` : ""}
    `),
  };
}

// ============================================================================
// Sale confirmation receipt (with optional GST invoice link)
// ============================================================================

export interface SaleConfirmationEmailVars {
  buyerName?: string | null;
  sellerLegalName?: string | null;
  productName?: string | null;
  amountInr: number;
  currency?: string;
  orderId: string;
  /** Direct signed URL or public download endpoint for the GST invoice PDF. */
  invoiceUrl?: string | null;
  /** Order detail page URL (where the buyer can self-serve). */
  orderUrl?: string | null;
}

export function saleConfirmationEmail(vars: SaleConfirmationEmailVars): {
  subject: string;
  html: string;
} {
  const hello = vars.buyerName ? `Hi ${vars.buyerName},` : "Hi,";
  const product = vars.productName ?? "Your purchase";
  const seller = vars.sellerLegalName ?? "the seller";
  const currency = vars.currency ?? "INR";
  const amount = vars.amountInr.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  const orderShort = vars.orderId.slice(0, 12) + "…";
  return {
    subject: `Receipt — ${product} (₹${amount})`,
    html: SHELL(`
      <h2 style="margin:0 0 12px;font-size:20px">Thanks for your purchase 🎉</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">
        Your payment for <strong>${escapeHtml(product)}</strong> from
        ${escapeHtml(seller)} was successful.
      </p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        <tr><td style="padding:6px 12px 6px 0;color:#71717a">Item</td><td style="padding:6px 0">${escapeHtml(product)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#71717a">Amount</td><td style="padding:6px 0">₹${amount} ${currency}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#71717a">Order id</td><td style="padding:6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${orderShort}</td></tr>
      </table>
      ${
        vars.invoiceUrl
          ? `<p style="margin:0 0 12px"><a href="${vars.invoiceUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Download GST invoice</a></p><p style="margin:0 0 12px;color:#71717a;font-size:12px">Link is valid for 7 days. You can always re-download from your order page.</p>`
          : ""
      }
      ${
        vars.orderUrl
          ? `<p style="margin:0 0 12px"><a href="${vars.orderUrl}" style="color:#0a0a0a">View order details →</a></p>`
          : ""
      }
    `),
  };
}

// ============================================================================
// Cart-recovery templates
// ============================================================================

interface RecoveryCommon {
  buyerName: string | null;
  sellerName: string;
  productName: string;
  productImage: string | null;
  productPrice: number | null;
  recoveryUrl: string;
}

function recoveryHero(args: RecoveryCommon, kicker: string): string {
  const price =
    args.productPrice == null
      ? ""
      : `₹${args.productPrice.toLocaleString("en-IN")}`;
  return `
    <p style="margin:0 0 12px;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:1.4px">${escapeHtml(
      kicker,
    )}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 18px">
      <tr>
        ${
          args.productImage
            ? `<td style="width:88px;padding-right:14px;vertical-align:top"><img src="${args.productImage}" width="88" height="88" style="display:block;border-radius:8px;border:1px solid #e4e4e7;object-fit:cover" alt="" /></td>`
            : ""
        }
        <td style="vertical-align:top">
          <p style="margin:0 0 2px;font-size:16px;font-weight:600;color:#18181b">${escapeHtml(
            args.productName,
          )}</p>
          ${price ? `<p style="margin:0;color:#52525b;font-size:13px">${price}</p>` : ""}
          <p style="margin:8px 0 0;color:#71717a;font-size:12px">from ${escapeHtml(args.sellerName)}</p>
        </td>
      </tr>
    </table>
  `;
}

export function recoveryEmail1(args: RecoveryCommon): {
  subject: string;
  html: string;
} {
  const hello = args.buyerName ? `Hi ${args.buyerName},` : "Hi,";
  const subject = args.buyerName
    ? `You left something behind, ${args.buyerName}`
    : `You left something behind`;
  return {
    subject,
    html: SHELL(`
      ${recoveryHero(args, "Almost yours")}
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">
        You were one click away from buying <strong>${escapeHtml(args.productName)}</strong>.
        We saved your cart — pick up where you left off below.
      </p>
      <p style="margin:0 0 14px">
        <a href="${args.recoveryUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600">Complete your purchase →</a>
      </p>
      <p style="margin:0;color:#a1a1aa;font-size:11px">If the button doesn't work, copy this link into your browser: <span style="color:#52525b">${args.recoveryUrl}</span></p>
    `),
  };
}

export interface RecoveryEmail2Vars extends RecoveryCommon {
  couponCode: string | null;
  couponLabel: string | null;
}

export function recoveryEmail2(args: RecoveryEmail2Vars): {
  subject: string;
  html: string;
} {
  const hello = args.buyerName ? `Hi ${args.buyerName},` : "Hi,";
  const subject = args.couponCode
    ? `${args.couponLabel ?? "A little something off"} — ${args.productName}`
    : `Still thinking it over?`;
  const couponBlock = args.couponCode
    ? `
        <div style="margin:0 0 18px;border:1px dashed #e4e4e7;border-radius:8px;padding:14px 16px;background:#fafafa">
          <p style="margin:0 0 4px;color:#18181b;font-size:14px">
            Here's <strong>${escapeHtml(args.couponLabel ?? "a discount")}</strong> to complete your order.
          </p>
          <p style="margin:0;font-size:18px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;color:#18181b;letter-spacing:1.5px">${escapeHtml(args.couponCode)}</p>
          <p style="margin:6px 0 0;color:#71717a;font-size:11px">Apply it at checkout — valid while stocks last.</p>
        </div>`
    : "";
  return {
    subject,
    html: SHELL(`
      ${recoveryHero(args, args.couponCode ? "One-day only" : "Last chance")}
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">
        Just checking in — you started checking out <strong>${escapeHtml(args.productName)}</strong>
        yesterday on ${escapeHtml(args.sellerName)}'s page but didn't finish.
      </p>
      ${couponBlock}
      <p style="margin:0 0 14px">
        <a href="${args.recoveryUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600">
          ${args.couponCode ? `Use ${args.couponCode} now →` : `Complete your purchase →`}
        </a>
      </p>
      <p style="margin:0;color:#a1a1aa;font-size:11px">If the button doesn't work, copy this link into your browser: <span style="color:#52525b">${args.recoveryUrl}</span></p>
    `),
  };
}
