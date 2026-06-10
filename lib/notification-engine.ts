// Notification engine — one entry point that fans a single event out across
// every channel the recipient has enabled (in-app bell, email, WhatsApp, SMS).
//
// Design:
//   • The CALLER builds a payload per channel it wants to attempt and passes
//     them in `payloads`. The engine decides, per channel, whether to actually
//     send — gating on (a) the event registry (eventSupportsChannel) and
//     (b) the recipient's saved preferences (isChannelEnabled).
//   • Everything is BEST-EFFORT. A failure on any channel is caught, recorded
//     in the result, and never thrown into the core flow that triggered it.
//   • External sends (email/WhatsApp/SMS) self-log to `notification_logs` via
//     their senders; in-app writes go to the `notifications` table. The engine
//     adds no logging of its own — it only orchestrates.

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { sendWhatsApp, sendSms, type WaTemplateName } from "@/lib/twilio";
import {
  eventSupportsChannel,
  isChannelEnabled,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationsConfig,
} from "@/lib/notifications-config";

// ── Per-channel payloads ────────────────────────────────────────────────────

export interface InAppPayload {
  title: string;
  body?: string | null;
  link?: string | null;
  meta?: Record<string, unknown>;
}

export interface EmailPayload {
  subject: string;
  html: string;
  text?: string;
}

export interface WhatsAppPayload {
  template: WaTemplateName | string;
  variables: string[];
}

export interface SmsPayload {
  message: string;
}

export interface DispatchPayloads {
  inApp?: InAppPayload;
  email?: EmailPayload;
  whatsapp?: WhatsAppPayload;
  sms?: SmsPayload;
}

export interface DispatchInput {
  event: NotificationEventKey;
  /** The seller / user who receives this. Used to load prefs + as in-app target. */
  recipientUserId: string;
  payloads: DispatchPayloads;
  /** Optional pre-loaded recipient context to skip the profile read. */
  recipient?: RecipientContext;
}

export interface RecipientContext {
  email: string | null;
  fullName: string | null;
  config: NotificationsConfig | null;
  /** Verified E.164 number (no '+'). Used for both WhatsApp and SMS. */
  phone: string | null;
}

export type ChannelOutcome =
  | "sent"
  | "off" // turned off in the recipient's preferences
  | "unsupported" // event can't use this channel (registry)
  | "no_payload" // caller didn't supply a payload for this channel
  | "no_destination" // missing email / phone
  | "failed";

export type DispatchResult = Record<NotificationChannel, ChannelOutcome>;

// ── Recipient loading ───────────────────────────────────────────────────────

export async function loadRecipientContext(
  userId: string,
): Promise<RecipientContext | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_profiles")
      .select("email, full_name, notifications_config, whatsapp_verified_number")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return {
      email: data.email ?? null,
      fullName: data.full_name ?? null,
      config: (data.notifications_config as NotificationsConfig | null) ?? null,
      phone: data.whatsapp_verified_number ?? null,
    };
  } catch (e) {
    console.error("[notify-engine] loadRecipientContext failed", e);
    return null;
  }
}

// ── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Fan `event` out across all four channels, each gated by registry + prefs.
 * Returns a per-channel outcome map so callers/tests can assert what fired.
 * Never throws.
 */
export async function dispatchNotification(
  input: DispatchInput,
): Promise<DispatchResult> {
  const { event, recipientUserId, payloads } = input;
  const result: DispatchResult = {
    inapp: "no_payload",
    email: "no_payload",
    whatsapp: "no_payload",
    sms: "no_payload",
  };

  const recipient =
    input.recipient ?? (await loadRecipientContext(recipientUserId));
  if (!recipient) {
    // Couldn't resolve the recipient — mark every requested channel failed.
    for (const ch of ["inapp", "email", "whatsapp", "sms"] as const) {
      if (payloads[payloadKey(ch)]) result[ch] = "failed";
    }
    return result;
  }

  const cfg = recipient.config;

  // Helper that applies the common gate (payload → registry → prefs) and runs
  // `send` only when all gates pass, recording the outcome.
  async function attempt(
    channel: NotificationChannel,
    hasPayload: boolean,
    hasDestination: boolean,
    send: () => Promise<{ ok: boolean }>,
  ): Promise<void> {
    if (!hasPayload) {
      result[channel] = "no_payload";
      return;
    }
    if (!eventSupportsChannel(event, channel)) {
      result[channel] = "unsupported";
      return;
    }
    if (!isChannelEnabled(cfg, channel, event)) {
      result[channel] = "off";
      return;
    }
    if (!hasDestination) {
      result[channel] = "no_destination";
      return;
    }
    try {
      const r = await send();
      result[channel] = r.ok ? "sent" : "failed";
    } catch (e) {
      console.error(`[notify-engine] ${channel} send threw for ${event}`, e);
      result[channel] = "failed";
    }
  }

  await Promise.all([
    attempt("inapp", !!payloads.inApp, true, async () => {
      await createNotification({
        userId: recipientUserId,
        type: event,
        title: payloads.inApp!.title,
        body: payloads.inApp!.body ?? null,
        link: payloads.inApp!.link ?? null,
        meta: payloads.inApp!.meta ?? {},
      });
      return { ok: true };
    }),

    attempt("email", !!payloads.email, !!recipient.email, async () => {
      const { sendEmail } = await import("@/lib/email");
      const r = await sendEmail({
        to: recipient.email as string,
        subject: payloads.email!.subject,
        html: payloads.email!.html,
        text: payloads.email!.text,
        role: "seller",
      });
      return { ok: r.ok !== false };
    }),

    attempt("whatsapp", !!payloads.whatsapp, !!recipient.phone, async () => {
      const r = await sendWhatsApp(
        recipient.phone as string,
        payloads.whatsapp!.template,
        payloads.whatsapp!.variables,
      );
      return { ok: r.ok !== false && !r.skipped };
    }),

    attempt("sms", !!payloads.sms, !!recipient.phone, async () => {
      const r = await sendSms({
        to: recipient.phone as string,
        message: payloads.sms!.message,
      });
      return { ok: r.ok !== false && !r.skipped };
    }),
  ]);

  return result;
}

function payloadKey(ch: NotificationChannel): keyof DispatchPayloads {
  return ch === "inapp" ? "inApp" : (ch as keyof DispatchPayloads);
}
