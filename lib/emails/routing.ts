// Pure email-routing primitives — no I/O, no server-only, so this is safe to
// import from client components and unit tests. The actual SMTP transport lives
// in ./smtp.ts and the template renderers in ./send.ts.

export type MailboxRole =
  | "kyc"
  | "seller"
  | "buyer"
  | "support"
  | "noreply"
  | "onboarding"
  | "billing"
  | "legal";

export const MAILBOX_ROLES: MailboxRole[] = [
  "kyc",
  "seller",
  "buyer",
  "support",
  "noreply",
  "onboarding",
  "billing",
  "legal",
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
  | "abandoned_recovery_1"
  | "abandoned_recovery_2"
  | "lead_notification";

// Each template leaves from an audience-appropriate Gmail mailbox (when the
// admin has configured it). Unconfigured roles fall back to Resend.
export const TEMPLATE_ROLE: Record<TemplateKey, MailboxRole> = {
  order_confirmation: "billing",
  payment_failed: "billing",
  welcome: "onboarding",
  subscription_renewal: "billing",
  abandoned_recovery_1: "buyer",
  abandoned_recovery_2: "buyer",
  lead_notification: "seller",
};
