// MSG91 wrappers — WhatsApp templated messages + SMS OTP.
//
// Both endpoints fail-soft when credentials are missing so notification
// failures never break the core payment / lead flow.
//
// Docs:
//   WhatsApp:  https://docs.msg91.com/whatsapp/send-message
//   SMS:       https://docs.msg91.com/sms/send-sms-api
//   OTP (SMS): https://docs.msg91.com/otp/send-otp

import crypto from "node:crypto";

// ---- Template registry ------------------------------------------------------

/**
 * Names of the WhatsApp templates this app uses. These must be pre-registered
 * with MSG91 against the seller's WABA before the API will let us send them.
 *
 * The MSG91 "name" field on the template payload is what the API matches on,
 * not the variable IDs.
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

function normalisePhone(input: string): string {
  // MSG91 expects digits only (country code + number, no '+').
  return input.replace(/[^0-9]/g, "");
}

// ---- WhatsApp ---------------------------------------------------------------

/**
 * Send an approved WhatsApp template message via MSG91.
 *
 * Variables substitute into body_1, body_2, ... in order — the order MUST
 * match the variable order registered for the template with MSG91.
 *
 * `to` should be E.164 (with or without leading '+').
 */
export async function sendWhatsApp(
  to: string,
  template_id: WaTemplateName | string,
  variables: string[] = [],
): Promise<WaResult> {
  const key = process.env.MSG91_AUTH_KEY;
  const integrated = process.env.MSG91_WA_FROM ?? "";
  const namespace = process.env.MSG91_WA_NAMESPACE ?? "";
  if (!key || !integrated) {
    console.warn("[msg91] WhatsApp credentials not set — skipping send", {
      to,
      template_id,
    });
    return { ok: true, skipped: true };
  }

  // MSG91 caps variables at body_1..body_10 for our template type — anything
  // beyond is silently dropped at the API. Build the components map dynamically.
  const components: Record<string, { type: "text"; value: string }> = {};
  variables.forEach((value, idx) => {
    components[`body_${idx + 1}`] = { type: "text", value: String(value ?? "") };
  });

  const payload = {
    integrated_number: integrated,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: template_id,
        language: { code: "en", policy: "deterministic" },
        namespace,
        to_and_components: [
          {
            to: [normalisePhone(to)],
            components,
          },
        ],
      },
    },
  };

  try {
    const res = await fetch(
      "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authkey: key,
          "Auth-Key": key, // some MSG91 docs reference the cased header
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as {
      request_id?: string;
      message?: string;
    };
    return { ok: true, id: json.request_id, message: json.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ---- SMS (used for OTP delivery) -------------------------------------------

export interface SmsArgs {
  to: string;
  message: string;
  /** Optional MSG91 template ID for DLT-compliant SMS sends in India. */
  template_id?: string;
  /** Override sender ID (6 chars). */
  sender?: string;
}

/**
 * Send a plain SMS — used for the WhatsApp number OTP verification flow.
 *
 * Falls back to MSG91 "flow" send when MSG91_SMS_TEMPLATE_ID is set, otherwise
 * uses the v5 send-sms endpoint with a literal message body.
 */
export async function sendSms(args: SmsArgs): Promise<WaResult> {
  const key = process.env.MSG91_AUTH_KEY;
  if (!key) {
    console.warn("[msg91] MSG91_AUTH_KEY not set — skipping SMS send", {
      to: args.to,
    });
    return { ok: true, skipped: true };
  }
  const sender = args.sender ?? process.env.MSG91_SMS_SENDER ?? "INVOXAI";
  const templateId = args.template_id ?? process.env.MSG91_SMS_TEMPLATE_ID;
  const to = normalisePhone(args.to);

  try {
    // Preferred path: flow with a DLT template (required for Indian SMS).
    if (templateId) {
      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: { "content-type": "application/json", authkey: key },
        body: JSON.stringify({
          template_id: templateId,
          short_url: 0,
          recipients: [{ mobiles: to, otp: args.message }],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, message: `HTTP ${res.status} ${text.slice(0, 200)}` };
      }
      return { ok: true };
    }
    // Fallback: raw SMS send (works in non-DLT regions / sandbox).
    const url = `https://api.msg91.com/api/v5/send?sender=${encodeURIComponent(
      sender,
    )}&route=4&country=91&mobiles=${to}&message=${encodeURIComponent(args.message)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { authkey: key },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ---- OTP helpers (server-side, used by verify-whatsapp routes) -------------

/** Generate a numeric OTP of the given length. */
export function generateOtp(length = 6): string {
  // Reject 0-leading numbers cleanly by zero-padding the result.
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
