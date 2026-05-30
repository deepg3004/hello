// Shape of user_profiles.notifications_config (JSONB).
//
// Pure types + defaults — no runtime imports, safe to use from client too.

export type NotificationEventKey =
  | "new_sale"
  | "payment_failed"
  | "new_lead"
  | "payout_initiated"
  | "payout_completed"
  | "kyc_update"
  | "subscription_renewal";

export interface NotificationEventToggles {
  new_sale?: boolean;
  payment_failed?: boolean;
  new_lead?: boolean;
  payout_initiated?: boolean;
  payout_completed?: boolean;
  kyc_update?: boolean;
  subscription_renewal?: boolean;
}

export interface NotificationsConfig {
  /** Master switch — when off, no WhatsApp messages are sent. */
  enabled?: boolean;
  /** Verified WhatsApp number (E.164, no '+'). Duplicated from
   *  user_profiles.whatsapp_verified_number for fast reads. */
  whatsapp_number?: string;
  /** Per-event toggles. When undefined, falls back to the event default. */
  events?: NotificationEventToggles;
  /** Email-channel toggles (defaults to all on). */
  email?: NotificationEventToggles;
}

export const DEFAULT_EVENT_TOGGLES: Required<NotificationEventToggles> = {
  new_sale: true,
  payment_failed: true,
  new_lead: true,
  payout_initiated: true,
  payout_completed: true,
  kyc_update: true,
  subscription_renewal: true,
};

export const EVENTS: Array<{
  key: NotificationEventKey;
  label: string;
  description: string;
}> = [
  {
    key: "new_sale",
    label: "New sale received",
    description: "When a buyer completes a purchase on one of your pages.",
  },
  {
    key: "payment_failed",
    label: "Payment failed",
    description: "When a buyer's payment attempt fails on Razorpay.",
  },
  {
    key: "new_lead",
    label: "New lead captured",
    description: "When someone submits a lead form (landing / lead magnet).",
  },
  {
    key: "payout_initiated",
    label: "Payout initiated",
    description: "When your payout request leaves InvoxAI for your bank.",
  },
  {
    key: "payout_completed",
    label: "Payout completed",
    description: "When the bank confirms your payout has landed.",
  },
  {
    key: "kyc_update",
    label: "KYC status update",
    description: "Approvals / rejections from your KYC submission.",
  },
  {
    key: "subscription_renewal",
    label: "Subscription renewal reminder",
    description: "3 days before your InvoxAI subscription renews.",
  },
];

export function isEventEnabled(
  cfg: NotificationsConfig | null | undefined,
  key: NotificationEventKey,
): boolean {
  if (!cfg) return false;
  if (cfg.enabled === false) return false;
  const toggles = cfg.events ?? {};
  const v = toggles[key];
  return v === undefined ? DEFAULT_EVENT_TOGGLES[key] : v;
}

export function isEmailEventEnabled(
  cfg: NotificationsConfig | null | undefined,
  key: NotificationEventKey,
): boolean {
  // Email defaults to on regardless of master switch (master gates WhatsApp).
  if (!cfg?.email) return DEFAULT_EVENT_TOGGLES[key];
  const v = cfg.email[key];
  return v === undefined ? DEFAULT_EVENT_TOGGLES[key] : v;
}
