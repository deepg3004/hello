// Thin Resend wrapper + the transactional templates we send today.
//
// All functions return ok:true even when Resend isn't configured — that lets
// callers (verify-payment, cron) treat email as best-effort without breaking
// the user-facing flow.

import { Resend } from "resend";

import { sendViaSmtp, getAdminBcc, type MailboxRole } from "@/lib/emails/smtp";
import { SHELL, ctaButton, escapeHtml, kvRow } from "@/lib/emails/layout";
import { logNotification } from "@/lib/notification-log";

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
  /** Seller whose buyer-facing email this is. When that seller has active
   *  custom SMTP (Session 14), send from THEIR domain first. */
  sellerId?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  message?: string;
  skipped?: boolean;
}

async function sendEmailInner(args: SendArgs): Promise<SendResult> {
  // Seller custom SMTP first (Session 14) — send buyer-facing email from the
  // seller's own domain when configured. Open-tracking sends (tags) skip this
  // to keep Resend's `email.opened` webhook working.
  if (args.sellerId && !args.tags?.length) {
    const { trySellerEmail } = await import("@/lib/seller-smtp");
    const sent = await trySellerEmail(args.sellerId, {
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.reply_to,
    });
    if (sent) return { ok: true };
  }

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

/** Public sender — delegates to the impl and records the attempt (best-effort,
 *  fire-and-forget) to notification_logs. */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const result = await sendEmailInner(args);
  void logNotification({
    channel: "email",
    recipient: args.to,
    subject: args.subject,
    sellerId: args.sellerId ?? null,
    provider: "email",
    result,
  });
  return result;
}

// ============================================================================
// Templates — all use the shared premium shell (lib/emails/layout): branded
// masthead, inbox-preview preheader, consistent CTA buttons + footer.
// ============================================================================

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
  const group = escapeHtml(vars.groupName ?? "the VIP group");
  const renew = vars.renewUrl ? ctaButton(vars.renewUrl, "Renew access") : "";
  return {
    subject: `Your access to ${vars.groupName ?? "the VIP group"} has expired`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Your VIP access has expired</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Your access to <strong>${group}</strong> just ran out and you've been removed from the group.</p>
      ${renew}
      <p style="margin:0;color:#71717a;font-size:12px">If you renew, we'll send you a fresh invite link.</p>
    `,
      { preheader: `Your access to ${group} ended.` },
    ),
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
  const group = escapeHtml(vars.groupName ?? "the VIP group");
  const renew = vars.renewUrl ? ctaButton(vars.renewUrl, "Renew now") : "";
  return {
    subject: `${vars.daysLeft} day${vars.daysLeft === 1 ? "" : "s"} left — ${vars.groupName ?? "the VIP group"}`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Your VIP access ends in ${vars.daysLeft} day${vars.daysLeft === 1 ? "" : "s"}</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Heads up — your access to <strong>${group}</strong> ends soon. Renew now and we'll keep you in the room without interruption.</p>
      ${renew}
    `,
      { preheader: `${vars.daysLeft} day${vars.daysLeft === 1 ? "" : "s"} left on your ${group} access.` },
    ),
  };
}

export interface InviteEmailVars {
  buyerName?: string;
  groupName?: string;
  inviteLink: string;
}

export function inviteEmail(vars: InviteEmailVars): { subject: string; html: string } {
  const hello = vars.buyerName ? `Hi ${vars.buyerName},` : "Hi,";
  const group = escapeHtml(vars.groupName ?? "the VIP group");
  return {
    subject: `Your invite to ${vars.groupName ?? "the VIP group"}`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Welcome 👋</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Tap the button below to join <strong>${group}</strong> on Telegram. The link is for you only and expires in 10 minutes.</p>
      ${ctaButton(vars.inviteLink, "Open in Telegram", "#0088cc")}
      <p style="margin:0;color:#71717a;font-size:12px;word-break:break-all">${escapeHtml(vars.inviteLink)}</p>
    `,
      { preheader: `Your private invite to ${group} (expires in 10 min).` },
    ),
  };
}

// ============================================================================
// Lead-magnet / CRM templates
// ============================================================================

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
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">You're in</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5;white-space:pre-wrap">${escapeHtml(body)}</p>
    `,
      { preheader: "Thanks for signing up — we've got your details." },
    ),
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
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Here's your download</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">Tap the button below to grab your file.</p>
      ${ctaButton(vars.downloadUrl, "Download now")}
      <p style="margin:0;color:#71717a;font-size:12px">${escapeHtml(vars.expiresLabel ?? "Link expires in 7 days.")}</p>
    `,
      { preheader: `Your download from ${escapeHtml(vars.pageTitle ?? "InvoxAI")} is ready.` },
    ),
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
    .map(([k, v]) => kvRow(k, escapeHtml(String(v))))
    .join("");

  return {
    subject: `New lead from ${vars.pageTitle ?? "your page"}`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">New lead captured</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
        ${kvRow("Name", escapeHtml(vars.leadName ?? "—"))}
        ${kvRow("Email", escapeHtml(vars.leadEmail))}
        ${vars.leadPhone ? kvRow("Phone", escapeHtml(vars.leadPhone)) : ""}
        ${vars.pageTitle ? kvRow("Page", escapeHtml(vars.pageTitle)) : ""}
        ${customs}
      </table>
      ${vars.crmUrl ? ctaButton(vars.crmUrl, "Open in CRM") : ""}
    `,
      { preheader: `${escapeHtml(vars.leadName ?? vars.leadEmail)} just signed up.` },
    ),
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
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Thanks for your purchase 🎉</h2>
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">
        Your payment for <strong>${escapeHtml(product)}</strong> from
        ${escapeHtml(seller)} was successful.
      </p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Item", escapeHtml(product))}
        ${kvRow("Amount", `₹${amount} ${escapeHtml(currency)}`)}
        ${kvRow("Order id", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${orderShort}</span>`)}
      </table>
      ${
        vars.invoiceUrl
          ? `${ctaButton(vars.invoiceUrl, "Download GST invoice")}<p style="margin:0 0 12px;color:#71717a;font-size:12px">Link is valid for 7 days. You can always re-download from your order page.</p>`
          : ""
      }
      ${
        vars.orderUrl
          ? `<p style="margin:0 0 12px"><a href="${vars.orderUrl}" style="color:#0a0a0a">View order details →</a></p>`
          : ""
      }
    `,
      { preheader: `Receipt for ${escapeHtml(product)} — ₹${amount}.` },
    ),
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
    html: SHELL(
      `
      ${recoveryHero(args, "Almost yours")}
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">
        You were one click away from buying <strong>${escapeHtml(args.productName)}</strong>.
        We saved your cart — pick up where you left off below.
      </p>
      ${ctaButton(args.recoveryUrl, "Complete your purchase →")}
      <p style="margin:0;color:#a1a1aa;font-size:11px">If the button doesn't work, copy this link into your browser: <span style="color:#52525b">${escapeHtml(args.recoveryUrl)}</span></p>
    `,
      { preheader: `Your cart for ${escapeHtml(args.productName)} is still saved.` },
    ),
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
    html: SHELL(
      `
      ${recoveryHero(args, args.couponCode ? "One-day only" : "Last chance")}
      <p style="margin:0 0 12px;line-height:1.5">${hello}</p>
      <p style="margin:0 0 16px;line-height:1.5">
        Just checking in — you started checking out <strong>${escapeHtml(args.productName)}</strong>
        yesterday on ${escapeHtml(args.sellerName)}'s page but didn't finish.
      </p>
      ${couponBlock}
      ${ctaButton(
        args.recoveryUrl,
        args.couponCode ? `Use ${args.couponCode} now →` : `Complete your purchase →`,
      )}
      <p style="margin:0;color:#a1a1aa;font-size:11px">If the button doesn't work, copy this link into your browser: <span style="color:#52525b">${escapeHtml(args.recoveryUrl)}</span></p>
    `,
      {
        preheader: args.couponCode
          ? `${args.couponLabel ?? "A discount"} inside — finish your order.`
          : `Still thinking about ${args.productName}?`,
      },
    ),
  };
}
