// =============================================================================
// Buyer accounts (migration 087) — server-only helpers shared by the Google
// OAuth callback and the email-OTP verify route, so every portal login lands a
// profile row + an audit event the same way.
// =============================================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPlatformOwnHost,
  extractSubdomain,
  platformRootDomain,
} from "@/lib/domains";

export type BuyerProvider = "google" | "email_otp";

// buyer_login_events.ip_address is a Postgres `inet` — a non-IP string like the
// "unknown" fallback would fail the cast and drop the audit row, so coerce
// anything that isn't a plausible IPv4/IPv6 literal to null.
function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v = ip.trim();
  const isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(v);
  const isV6 = v.includes(":") && /^[0-9a-fA-F:]+$/.test(v);
  return isV4 || isV6 ? v : null;
}

export interface BuyerLoginInput {
  email: string;
  provider: BuyerProvider;
  name?: string | null;
  avatarUrl?: string | null;
  googleId?: string | null;
  emailVerified?: boolean;
  host?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Upsert the buyer's account on login and append an audit event. Best-effort:
 * a failure here must never block the login itself (the session cookie is the
 * source of truth), so callers can fire-and-forget. Keyed on the (lowercased)
 * email, which is how the whole portal already joins a buyer to their orders.
 */
export async function recordBuyerLogin(
  input: BuyerLoginInput,
  db?: SupabaseClient,
): Promise<void> {
  const admin = db ?? createAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const nowIso = new Date().toISOString();

  try {
    // Find any existing account so we bump login_count and never clobber a
    // stored name/avatar with nulls from a provider that didn't supply them.
    const { data: existing } = await admin
      .from("buyers")
      .select("id, name, avatar_url, google_id, login_count")
      .eq("email", email)
      .maybeSingle();

    const row = {
      email,
      name: input.name?.trim() || existing?.name || null,
      avatar_url: input.avatarUrl || existing?.avatar_url || null,
      google_id: input.googleId || existing?.google_id || null,
      primary_provider: input.provider,
      email_verified: input.emailVerified ?? input.provider === "google",
      last_login_at: nowIso,
      login_count: (existing?.login_count ?? 0) + 1,
      updated_at: nowIso,
    };

    let buyerId = existing?.id ?? null;
    if (existing) {
      await admin.from("buyers").update(row).eq("id", existing.id);
    } else {
      const { data: inserted } = await admin
        .from("buyers")
        .insert({ ...row, first_login_at: nowIso })
        .select("id")
        .maybeSingle();
      buyerId = inserted?.id ?? null;
    }

    await admin.from("buyer_login_events").insert({
      buyer_id: buyerId,
      email,
      provider: input.provider,
      host: input.host ?? null,
      ip_address: sanitizeIp(input.ip),
      user_agent: input.userAgent ? input.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    console.error("[buyers] recordBuyerLogin failed", e);
  }
}

/**
 * Guard for the Google OAuth flow: only sign an OAuth `state` (and later
 * redirect the buyer back) for a host we actually serve — a platform host, a
 * *.invoxai.io seller subdomain, or a seller's verified custom domain. Without
 * this, a crafted Host header could turn the post-consent redirect into an
 * open-redirect to an attacker domain.
 */
export async function isKnownSellerHost(
  host: string,
  db?: SupabaseClient,
): Promise<boolean> {
  const h = (host || "").toLowerCase().split(":")[0];
  if (!h) return false;
  if (isPlatformOwnHost(h)) return true;
  if (h.endsWith(`.${platformRootDomain().toLowerCase()}`) && extractSubdomain(h)) {
    return true;
  }
  try {
    const admin = db ?? createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("id")
      .eq("custom_domain", h)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
