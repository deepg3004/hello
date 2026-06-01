// Public facade — sendEmail(template, to, data).
// Picks the right template, resolves the envelope from platform_settings,
// then calls Resend. Returns {ok:true, skipped:true} when the API key isn't
// configured so callers can treat it as best-effort.
//
// Server-only.

import { getEmailEnvelope, getResend } from "./resend";
import type { OrderConfirmationData } from "./templates/order-confirmation";
import type { PaymentFailedData } from "./templates/payment-failed";
import type { WelcomeData } from "./templates/welcome";
import type { SubscriptionRenewalData } from "./templates/subscription-renewal";
import type { KycReceivedData } from "./templates/kyc-received";
import type { KycApprovedData } from "./templates/kyc-approved";
import type { KycRejectedData } from "./templates/kyc-rejected";
import type { RecoveryHero } from "./templates/abandoned-recovery-1";
import type { AbandonedRecovery2Data } from "./templates/abandoned-recovery-2";
import type { PayoutInitiatedData } from "./templates/payout-initiated";
import type { PayoutCompletedData } from "./templates/payout-completed";
import type { PayoutFailedData } from "./templates/payout-failed";
import type { LeadNotificationData } from "./templates/lead-notification";
import { renderEmail } from "./render";
import { sendViaSmtp, getAdminBcc } from "./smtp";
import { primeEmailBranding } from "./branding";
import { TEMPLATE_ROLE, type TemplateKey } from "./routing";

export type { TemplateKey };

// Strongly-typed map so callers get a compile error when they pass the
// wrong data shape for a template.
export interface TemplateDataMap {
  order_confirmation: OrderConfirmationData;
  payment_failed: PaymentFailedData;
  welcome: WelcomeData;
  subscription_renewal: SubscriptionRenewalData;
  kyc_received: KycReceivedData;
  kyc_approved: KycApprovedData;
  kyc_rejected: KycRejectedData;
  abandoned_recovery_1: RecoveryHero;
  abandoned_recovery_2: AbandonedRecovery2Data;
  payout_initiated: PayoutInitiatedData;
  payout_completed: PayoutCompletedData;
  payout_failed: PayoutFailedData;
  lead_notification: LeadNotificationData;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  message?: string;
  skipped?: boolean;
}

export interface SendOptions {
  /** Resend tags forwarded through — used by the open-tracking webhook. */
  tags?: Array<{ name: string; value: string }>;
  /** Override the resolved reply-to (e.g. point a buyer email at the seller). */
  reply_to?: string;
}

export async function sendEmail<K extends TemplateKey>(
  template: K,
  to: string,
  data: TemplateDataMap[K],
  options: SendOptions = {},
): Promise<SendResult> {
  // Refresh brand (name + logo) before rendering — TTL-guarded, so admin
  // changes show up within ~5 min without a restart.
  await primeEmailBranding();
  // renderEmail applies an admin override (email_templates CMS) if one exists,
  // else the built-in code template.
  const built = await renderEmail(template, data as Record<string, unknown>);

  // Gmail SMTP first — from the audience-appropriate mailbox. We skip SMTP when
  // the send carries Resend open-tracking tags (cart recovery) so that the
  // `email.opened` webhook keeps working; those go through Resend below.
  if (!options.tags?.length) {
    const smtp = await sendViaSmtp({
      role: TEMPLATE_ROLE[template],
      to,
      subject: built.subject,
      html: built.html,
      replyTo: options.reply_to,
    });
    if (smtp.ok) return { ok: true, id: smtp.id };
    if (!smtp.skipped) {
      // Configured but failed — log and fall through to Resend as a backstop.
      console.warn("[email] SMTP send failed, falling back to Resend", {
        to,
        template,
        message: smtp.message,
      });
    }
  }

  const envelope = await getEmailEnvelope();
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", {
      to,
      template,
      subject: built.subject,
    });
    return { ok: true, skipped: true };
  }
  const bcc = await getAdminBcc();
  try {
    const res = await resend.emails.send({
      from: envelope.from,
      to,
      bcc: bcc && bcc !== to ? bcc : undefined,
      subject: built.subject,
      html: built.html,
      replyTo: options.reply_to ?? envelope.reply_to,
      tags: options.tags,
    });
    if (res.error) return { ok: false, message: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

