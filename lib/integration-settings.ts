// =============================================================================
// Admin-configurable integration credentials. Server-only.
//
// Each getter prefers a value an admin saved in platform_settings (decrypted
// when stored encrypted) and falls back to the env var — so an operator can
// add/rotate a key from /admin/integrations without a redeploy, while env
// still works for bootstrapping. Reads are best-effort: any DB/decrypt failure
// silently falls through to env.
// =============================================================================

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptValue } from "@/lib/admin/vault";

/** Read one platform_settings row and return its plaintext (decrypting if the
 *  row is flagged encrypted), or null when absent/empty/unreadable. */
async function readStored(key: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value, encrypted")
      .eq("key", key)
      .maybeSingle<{ value: string | null; encrypted: boolean | null }>();
    const raw = data?.value;
    if (!raw) return null;
    if (data?.encrypted) {
      try {
        return decryptValue(raw);
      } catch {
        return null; // vault key missing/rotated — fall back to env
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

// ── Anthropic (AI website generator) ─────────────────────────────────────────
export interface AnthropicCredential {
  apiKey: string | null;
  authToken: string | null;
  /** "admin" when either value came from platform_settings, else "env"/"none". */
  source: "admin" | "env" | "none";
}

export async function getAnthropicCredential(): Promise<AnthropicCredential> {
  const [adminKey, adminToken] = await Promise.all([
    readStored("anthropic_api_key"),
    readStored("anthropic_auth_token"),
  ]);
  if (adminKey || adminToken) {
    return { apiKey: adminKey, authToken: adminToken, source: "admin" };
  }
  const envKey = env("ANTHROPIC_API_KEY");
  const envToken = env("ANTHROPIC_AUTH_TOKEN");
  if (envKey || envToken) {
    return { apiKey: envKey, authToken: envToken, source: "env" };
  }
  return { apiKey: null, authToken: null, source: "none" };
}

// ── Google buyer login ───────────────────────────────────────────────────────
export interface GoogleBuyerConfig {
  clientId: string | null;
  clientSecret: string | null;
  baseUrl: string | null;
  source: "admin" | "env" | "none";
}

export async function getGoogleBuyerConfig(): Promise<GoogleBuyerConfig> {
  const [aId, aSecret, aBase] = await Promise.all([
    readStored("google_client_id"),
    readStored("google_client_secret"),
    readStored("buyer_oauth_base_url"),
  ]);
  if (aId || aSecret) {
    return {
      clientId: aId,
      clientSecret: aSecret,
      baseUrl: aBase ?? env("BUYER_OAUTH_BASE_URL"),
      source: "admin",
    };
  }
  const eId = env("GOOGLE_CLIENT_ID");
  const eSecret = env("GOOGLE_CLIENT_SECRET");
  if (eId || eSecret) {
    return {
      clientId: eId,
      clientSecret: eSecret,
      baseUrl: env("BUYER_OAUTH_BASE_URL"),
      source: "env",
    };
  }
  return { clientId: null, clientSecret: null, baseUrl: env("BUYER_OAUTH_BASE_URL"), source: "none" };
}
