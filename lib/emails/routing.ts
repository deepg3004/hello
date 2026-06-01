// Pure email-routing primitives — no I/O, no server-only, so this is safe to
// import from client components and unit tests. The actual SMTP transport lives
// in ./smtp.ts and the template renderers in ./send.ts.

export type MailboxRole = "kyc" | "seller" | "buyer" | "support" | "noreply";

export const MAILBOX_ROLES: MailboxRole[] = [
  "kyc",
  "seller",
  "buyer",
  "support",
  "noreply",
];

export type MailboxField = "user" | "pass" | "from_name" | "reply_to";

/** Build the platform_settings key for a mailbox field, e.g. `smtp_kyc_pass`. */
export function smtpKey(role: MailboxRole, field: MailboxField): string {
  return `smtp_${role}_${field}`;
}

// Keys of the typed email facade (lib/emails/send.ts). Kept here so the
// template→mailbox map can be unit-tested without pulling in the server-only
// render pipeline.
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

// Each template leaves from an audience-appropriate Gmail mailbox (when the
// admin has configured it). Unconfigured roles fall back to Resend.
export const TEMPLATE_ROLE: Record<TemplateKey, MailboxRole> = {
  order_confirmation: "buyer",
  payment_failed: "buyer",
  welcome: "seller",
  subscription_renewal: "buyer",
  kyc_approved: "kyc",
  kyc_rejected: "kyc",
  abandoned_recovery_1: "buyer",
  abandoned_recovery_2: "buyer",
  payout_completed: "seller",
  lead_notification: "seller",
};
