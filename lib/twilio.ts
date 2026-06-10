// Twilio wrappers — WhatsApp templated messages + SMS OTP.
//
// Drop-in replacement for lib/msg91.ts. All exports keep the same names and
// signatures so call sites don't need to change beyond the import path.
//
// Backend: Twilio Programmable Messaging REST API
//   SMS:      https://www.twilio.com/docs/sms/api/message-resource
//   WhatsApp: https://www.twilio.com/docs/whatsapp/api
//   Content:  https://www.twilio.com/docs/content
//
// Required env vars:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER       — SMS sender, E.164 (+13393303027)
//   TWILIO_WHATSAPP_FROM      — "whatsapp:+14155238886" (sandbox) or your sender
//
// Optional per-template env vars (only set after Meta approves the template):
//   TWILIO_TEMPLATE_NEW_SALE              = HX...
//   TWILIO_TEMPLATE_PAYMENT_FAILED        = HX...
//   TWILIO_TEMPLATE_NEW_LEAD              = HX...
//   TWILIO_TEMPLATE_PAYOUT_DONE           = HX...
//   TWILIO_TEMPLATE_KYC_UPDATE            = HX...
//   TWILIO_TEMPLATE_PAYOUT_INITIATED      = HX...
//   TWILIO_TEMPLATE_SUBSCRIPTION_RENEWAL  = HX...
//   TWILIO_TEMPLATE_RECOVERY_CART         = HX...
//
// When a template's HX SID is set we send via ContentSid + ContentVariables.
// When it's missing we fall back to freeform Body (sandbox OK; production
// limited to the 24h conversation window).

import crypto from "node:crypto";

import { logNotification } from "@/lib/notification-log";

// ---- Template registry ------------------------------------------------------

/**
 * Names of the WhatsApp templates this app uses. Same keys + values as
 * lib/msg91.ts so existing imports compile unchanged.
 */
export const WA_TEMPLATES = {
  NEW_SALE: "INVOX_NEW_SALE",
  PAYMENT_FAILED: "INVOX_PAYMENT_FAILED",
  NEW_LEAD: "INVOX_NEW_LEAD",
  PAYOUT_DONE: "INVOX_PAYOUT_DONE",
  KYC_UPDATE: "INVOX_KYC_UPDATE",
  PAYOUT_INITIATED: "INVOX_PAYOUT_INITIATED",
  SUBSCRIPTION_RENEWAL: "INVOX_SUBSCRIPTION_RENEWAL",
  RECOVERY_CART: "INVOX_RECOVERY_CART",
} as const;

export type WaTemplateName = (typeof WA_TEMPLATES)[keyof typeof WA_TEMPLATES];

// ---- Common types -----------------------------------------------------------

export interface WaResult {
  ok: boolean;
  id?: string;
  message?: string;
  /** True when credentials are missing — caller can treat as a no-op. */
  skipped?: boolean;
}

export interface SmsArgs {
  to: string;
  message: string;
  /** Ignored on Twilio (kept for signature compat with lib/msg91). */
  template_id?: string;
  /** Ignored on Twilio — From is always TWILIO_PHONE_NUMBER. */
  sender?: string;
}

// ---- Helpers ----------------------------------------------------------------

function toE164(input: string): string {
  // Twilio strictly requires E.164 with leading '+'. Strip whitespace + the
  // common 'whatsapp:' prefix some callers pass.
  let s = input.trim().replace(/^whatsapp:/i, "");
  if (s.startsWith("+")) return s;
  // If it's all digits and looks like a country-coded number (10-15 digits),
  // assume India default for legacy MSG91 call sites that passed digits only.
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return `+${digits}`;
}

function twilioCreds(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

function basicAuth(sid: string, token: string): string {
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

/** Map a WaTemplateName → the optional Content SID env var. */
function getContentSid(name: WaTemplateName | string): string | undefined {
  // "INVOX_NEW_SALE" → "TWILIO_TEMPLATE_NEW_SALE"
  const stripped = String(name).replace(/^INVOX_/, "");
  return process.env[`TWILIO_TEMPLATE_${stripped}`];
}

/**
 * Fallback message body for each template, used when no Content SID is set
 * (sandbox testing, or before Meta approves the template). Variables are
 * substituted by index ({{1}}, {{2}}, ...).
 *
 * Keep the order in sync with the call sites in lib/notification-triggers.ts
 * and lib/recovery-runner.ts — they pass variables positionally.
 */
function fallbackBody(name: WaTemplateName | string, vars: string[]): string {
  const v = (i: number) => vars[i] ?? "";
  switch (name) {
    case WA_TEMPLATES.NEW_SALE:
      // [buyer_name, product, amount, seller_amount, time]
      return `🎉 New sale on InvoxAI!\n${v(0)} bought ${v(1)} for ${v(2)}.\nYour share: ${v(3)}\nAt ${v(4)}`;
    case WA_TEMPLATES.PAYMENT_FAILED:
      // [buyer_name, buyer_email, page, amount, reason, time]
      return `⚠️ Payment failed\nBuyer: ${v(0)} (${v(1)})\nPage: ${v(2)}\nAmount: ${v(3)}\nReason: ${v(4)}\nAt ${v(5)}`;
    case WA_TEMPLATES.NEW_LEAD:
      // [name, email, phone, page_title, time]
      return `📝 New lead captured\n${v(0)} — ${v(1)} (${v(2)})\nPage: ${v(3)}\nAt ${v(4)}`;
    case WA_TEMPLATES.PAYOUT_DONE:
      // [amount, bank_last4, utr]
      return `💸 Payout of ${v(0)} completed.\nBank: ••••${v(1)}\nUTR: ${v(2)}`;
    case WA_TEMPLATES.PAYOUT_INITIATED:
      // [amount, bank_last4, payout_id]
      return `🔄 Payout of ${v(0)} initiated.\nBank: ••••${v(1)}\nRef: ${v(2)}`;
    case WA_TEMPLATES.KYC_UPDATE:
      // [status, reason, time]
      return `📋 KYC update: ${v(0)}\n${v(1)}\nAt ${v(2)}`;
    case WA_TEMPLATES.RECOVERY_CART:
      // [buyer_name, product, seller, url]
      return `🛒 Hi ${v(0)}, your cart for ${v(1)} from ${v(2)} is waiting.\nComplete: ${v(3)}`;
    case WA_TEMPLATES.SUBSCRIPTION_RENEWAL:
      // [plan or item]
      return `🔁 Subscription renewal: ${v(0)}`;
    default:
      // Unknown template — concatenate vars as best-effort.
      return `[${name}] ${vars.join(" | ")}`;
  }
}

/** Build the ContentVariables map Twilio expects for templated messages. */
function buildContentVariables(vars: string[]): string {
  const map: Record<string, string> = {};
  vars.forEach((value, idx) => {
    map[String(idx + 1)] = String(value ?? "");
  });
  return JSON.stringify(map);
}

async function twilioFetchMessage(
  form: Record<string, string>,
): Promise<WaResult> {
  const creds = twilioCreds();
  if (!creds) {
    return { ok: true, skipped: true };
  }
  const body = new URLSearchParams(form).toString();
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          Authorization: basicAuth(creds.sid, creds.token),
          Accept: "application/json",
        },
        body,
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      error_code?: number | null;
      error_message?: string | null;
      message?: string;
      code?: number;
    };
    if (!res.ok || json.error_code) {
      const msg =
        json.error_message ??
        json.message ??
        `Twilio HTTP ${res.status}`;
      return { ok: false, message: msg };
    }
    return { ok: true, id: json.sid };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ---- WhatsApp ---------------------------------------------------------------

/**
 * Send an approved WhatsApp template (or freeform sandbox body) via Twilio.
 *
 * - If TWILIO_TEMPLATE_<NAME> env is set → uses ContentSid + ContentVariables
 *   (required for production sends outside the 24h conversation window).
 * - Otherwise falls back to freeform Body (sandbox, or replies within 24h).
 *
 * `to` may be E.164 ("+91...") or digits-only ("918240972331"); we coerce.
 */
async function sendWhatsAppInner(
  to: string,
  template_id: WaTemplateName | string,
  variables: string[] = [],
): Promise<WaResult> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!twilioCreds() || !from) {
    console.warn("[twilio] WhatsApp credentials not set — skipping send", {
      to,
      template_id,
      have_creds: !!twilioCreds(),
      have_from: !!from,
    });
    return { ok: true, skipped: true };
  }

  const toAddr = `whatsapp:${toE164(to)}`;
  const contentSid = getContentSid(template_id);

  const form: Record<string, string> = {
    From: from,
    To: toAddr,
  };

  if (contentSid) {
    form.ContentSid = contentSid;
    if (variables.length > 0) {
      form.ContentVariables = buildContentVariables(variables);
    }
  } else {
    form.Body = fallbackBody(template_id, variables);
  }

  return twilioFetchMessage(form);
}

/** Public WhatsApp sender — delegates + records the attempt (best-effort). */
export async function sendWhatsApp(
  to: string,
  template_id: WaTemplateName | string,
  variables: string[] = [],
): Promise<WaResult> {
  const result = await sendWhatsAppInner(to, template_id, variables);
  void logNotification({
    channel: "whatsapp",
    recipient: to,
    eventKey: typeof template_id === "string" ? template_id : null,
    provider: "twilio",
    result,
  });
  return result;
}

// ---- SMS --------------------------------------------------------------------

/**
 * Send a plain SMS. Used for the WhatsApp-number OTP verification flow.
 *
 * For trial Twilio accounts, the recipient must be a verified Caller ID.
 * For production India delivery you need DLT registration + a Messaging
 * Service SID — drop a `template_id` mapping in here later if you set that up.
 */
async function sendSmsInner(args: SmsArgs): Promise<WaResult> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!twilioCreds() || !from) {
    console.warn("[twilio] SMS credentials not set — skipping send", {
      to: args.to,
      have_creds: !!twilioCreds(),
      have_from: !!from,
    });
    return { ok: true, skipped: true };
  }
  return twilioFetchMessage({
    From: from,
    To: toE164(args.to),
    Body: args.message,
  });
}

/** Public SMS sender — delegates + records the attempt (best-effort). */
export async function sendSms(args: SmsArgs): Promise<WaResult> {
  const result = await sendSmsInner(args);
  void logNotification({
    channel: "sms",
    recipient: args.to,
    provider: "twilio",
    result,
  });
  return result;
}

// ---- OTP helpers (server-side, used by verify-whatsapp routes) -------------
//
// These don't touch Twilio at all — they're crypto utilities the route
// handlers use to mint and verify OTPs. Kept here so call sites can import
// everything from a single file (same as lib/msg91 did).

/** Generate a numeric OTP of the given length. */
export function generateOtp(length = 6): string {
  const max = 10 ** length;
  const buf = crypto.randomBytes(4).readUInt32BE(0) % max;
  return String(buf).padStart(length, "0");
}

/** Hash an OTP for storage (server-only). */
export function hashOtp(otp: string): string {
  const salt = process.env.OTP_HASH_SALT ?? "invoxai_otp_v1";
  return crypto
    .createHmac("sha256", salt)
    .update(otp.trim())
    .digest("hex");
}
