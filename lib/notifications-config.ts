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

/** The four delivery channels the notification engine can dispatch to. */
export type NotificationChannel = "inapp" | "email" | "whatsapp" | "sms";

export const ALL_CHANNELS: NotificationChannel[] = [
  "inapp",
  "email",
  "whatsapp",
  "sms",
];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inapp: "In-app",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

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
  /** WhatsApp per-event toggles. When undefined, falls back to the default. */
  events?: NotificationEventToggles;
  /** Email-channel toggles (defaults to all on). */
  email?: NotificationEventToggles;
  /** In-app bell toggles (defaults to all on). */
  inapp?: NotificationEventToggles;
  /** SMS-channel toggles (defaults to all OFF — opt-in, metered). */
  sms?: NotificationEventToggles;
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

/** SMS defaults to OFF for every event (opt-in, metered, DLT-gated in India). */
export const DEFAULT_SMS_TOGGLES: Required<NotificationEventToggles> = {
  new_sale: false,
  payment_failed: false,
  new_lead: false,
  payout_initiated: false,
  payout_completed: false,
  kyc_update: false,
  subscription_renewal: false,
};

/**
 * Canonical event registry — the single source of truth the notification
 * engine and the seller preferences UI both read from. `channels` declares
 * exactly which channels an event can dispatch on; the engine never attempts
 * a channel that isn't listed, and the UI greys out unavailable channels.
 *
 * Note on in-app: `new_sale` deliberately omits "inapp" because that bell is
 * already raised by the separate `payment_received` in-app event at checkout —
 * listing it here would double-ring it.
 */
export interface NotificationEventDef {
  key: NotificationEventKey;
  label: string;
  description: string;
  channels: NotificationChannel[];
}

export const EVENTS: NotificationEventDef[] = [
  {
    key: "new_sale",
    label: "New sale received",
    description: "When a buyer completes a purchase on one of your pages.",
    channels: ["email", "whatsapp", "sms"],
  },
  {
    key: "payment_failed",
    label: "Payment failed",
    description: "When a buyer's payment attempt fails on Razorpay.",
    channels: ["inapp", "email", "whatsapp", "sms"],
  },
  {
    key: "new_lead",
    label: "New lead captured",
    description: "When someone submits a lead form (landing / lead magnet).",
    channels: ["inapp", "whatsapp", "sms"],
  },
  {
    key: "payout_initiated",
    label: "Payout initiated",
    description: "When your payout request leaves InvoxAI for your bank.",
    channels: ["inapp", "email", "whatsapp", "sms"],
  },
  {
    key: "payout_completed",
    label: "Payout completed",
    description: "When the bank confirms your payout has landed.",
    channels: ["inapp", "email", "whatsapp", "sms"],
  },
  {
    key: "kyc_update",
    label: "KYC status update",
    description: "Approvals / rejections from your KYC submission.",
    channels: ["inapp", "email", "whatsapp", "sms"],
  },
  {
    key: "subscription_renewal",
    label: "Subscription renewal reminder",
    description: "3 days before your InvoxAI subscription renews.",
    channels: ["inapp", "email", "whatsapp", "sms"],
  },
];

/** Does this event support delivery on the given channel at all? */
export function eventSupportsChannel(
  key: NotificationEventKey,
  channel: NotificationChannel,
): boolean {
  return EVENTS.find((e) => e.key === key)?.channels.includes(channel) ?? false;
}

/**
 * Generic per-channel, per-event preference check — the one function the
 * engine consults before dispatching. Channel-specific rules:
 *   • inapp   — defaults ON (the bell is free + non-intrusive).
 *   • email   — defaults ON, independent of the WhatsApp master switch.
 *   • whatsapp— defaults ON but gated behind the master switch (`enabled`).
 *   • sms     — defaults OFF (opt-in; SMS is metered and DLT-gated in India).
 */
export function isChannelEnabled(
  cfg: NotificationsConfig | null | undefined,
  channel: NotificationChannel,
  key: NotificationEventKey,
): boolean {
  switch (channel) {
    case "whatsapp": {
      if (!cfg || cfg.enabled === false) return false;
      return cfg.events?.[key] ?? DEFAULT_EVENT_TOGGLES[key];
    }
    case "email":
      return cfg?.email?.[key] ?? DEFAULT_EVENT_TOGGLES[key];
    case "inapp":
      return cfg?.inapp?.[key] ?? true;
    case "sms":
      return cfg?.sms?.[key] ?? false;
  }
}

// ── Back-compat shims (older call sites import these directly) ──────────────
export function isEventEnabled(
  cfg: NotificationsConfig | null | undefined,
  key: NotificationEventKey,
): boolean {
  return isChannelEnabled(cfg, "whatsapp", key);
}

export function isEmailEventEnabled(
  cfg: NotificationsConfig | null | undefined,
  key: NotificationEventKey,
): boolean {
  return isChannelEnabled(cfg, "email", key);
}
