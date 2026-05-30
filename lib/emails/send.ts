// Public facade — sendEmail(template, to, data).
// Picks the right template, resolves the envelope from platform_settings,
// then calls Resend. Returns {ok:true, skipped:true} when the API key isn't
// configured so callers can treat it as best-effort.
//
// Server-only.

import { getEmailEnvelope, getResend } from "./resend";
import {
  orderConfirmationEmail,
  type OrderConfirmationData,
} from "./templates/order-confirmation";
import {
  paymentFailedEmail,
  type PaymentFailedData,
} from "./templates/payment-failed";
import { welcomeEmail, type WelcomeData } from "./templates/welcome";
import {
  subscriptionRenewalEmail,
  type SubscriptionRenewalData,
} from "./templates/subscription-renewal";
import {
  kycApprovedEmail,
  type KycApprovedData,
} from "./templates/kyc-approved";
import {
  kycRejectedEmail,
  type KycRejectedData,
} from "./templates/kyc-rejected";
import {
  abandonedRecovery1Email,
  type RecoveryHero,
} from "./templates/abandoned-recovery-1";
import {
  abandonedRecovery2Email,
  type AbandonedRecovery2Data,
} from "./templates/abandoned-recovery-2";
import {
  payoutCompletedEmail,
  type PayoutCompletedData,
} from "./templates/payout-completed";
import {
  leadNotificationEmail,
  type LeadNotificationData,
} from "./templates/lead-notification";

export type TemplateKey =
  | "order_confirmation"
  | "payment_failed"
  | "welcome"
  | "subscription_renewal"
  | "kyc_approved"
  | "kyc_rejected"
  | "abandoned_recovery_1"
  | "abandoned_recovery_2"
  | "payout_completed"
  | "lead_notification";

// Strongly-typed map so callers get a compile error when they pass the
// wrong data shape for a template.
export interface TemplateDataMap {
  order_confirmation: OrderConfirmationData;
  payment_failed: PaymentFailedData;
  welcome: WelcomeData;
  subscription_renewal: SubscriptionRenewalData;
  kyc_approved: KycApprovedData;
  kyc_rejected: KycRejectedData;
  abandoned_recovery_1: RecoveryHero;
  abandoned_recovery_2: AbandonedRecovery2Data;
  payout_completed: PayoutCompletedData;
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
  const built = render(template, data);
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
  try {
    const res = await resend.emails.send({
      from: envelope.from,
      to,
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

function render<K extends TemplateKey>(
  template: K,
  data: TemplateDataMap[K],
): { subject: string; html: string } {
  switch (template) {
    case "order_confirmation":
      return orderConfirmationEmail(data as OrderConfirmationData);
    case "payment_failed":
      return paymentFailedEmail(data as PaymentFailedData);
    case "welcome":
      return welcomeEmail(data as WelcomeData);
    case "subscription_renewal":
      return subscriptionRenewalEmail(data as SubscriptionRenewalData);
    case "kyc_approved":
      return kycApprovedEmail(data as KycApprovedData);
    case "kyc_rejected":
      return kycRejectedEmail(data as KycRejectedData);
    case "abandoned_recovery_1":
      return abandonedRecovery1Email(data as RecoveryHero);
    case "abandoned_recovery_2":
      return abandonedRecovery2Email(data as AbandonedRecovery2Data);
    case "payout_completed":
      return payoutCompletedEmail(data as PayoutCompletedData);
    case "lead_notification":
      return leadNotificationEmail(data as LeadNotificationData);
    default: {
      const _exhaustive: never = template;
      throw new Error(`Unknown template: ${String(_exhaustive)}`);
    }
  }
}
