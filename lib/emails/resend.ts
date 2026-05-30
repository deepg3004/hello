// Singleton Resend client + envelope settings read from the admin
// `platform_settings` rows (with env-var fallbacks for dev).
//
// Server-only.

import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new Resend(key);
  return cached;
}

export interface EmailEnvelope {
  from: string;
  reply_to?: string;
}

let envelopeCache: { value: EmailEnvelope; expires_at: number } | null = null;
const ENVELOPE_TTL_MS = 60_000;

/**
 * Resolve {from, reply_to} from the platform_settings table (admin-editable),
 * falling back to env vars then hard-coded defaults. Cached for 60 s so a
 * blast of receipts doesn't hammer Postgres.
 */
export async function getEmailEnvelope(): Promise<EmailEnvelope> {
  if (envelopeCache && envelopeCache.expires_at > Date.now()) {
    return envelopeCache.value;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["email_from_address", "email_from_name", "email_reply_to"]);

  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.key, row.value);

  const fromAddr =
    map.get("email_from_address") ||
    process.env.RESEND_FROM_EMAIL_ADDRESS ||
    "noreply@invoxai.io";
  const fromName =
    map.get("email_from_name") ||
    process.env.RESEND_FROM_NAME ||
    "InvoxAI";
  const replyTo =
    map.get("email_reply_to") ||
    process.env.RESEND_REPLY_TO ||
    undefined;

  const value: EmailEnvelope = {
    from: `${fromName} <${fromAddr}>`,
    reply_to: replyTo,
  };
  envelopeCache = { value, expires_at: Date.now() + ENVELOPE_TTL_MS };
  return value;
}
