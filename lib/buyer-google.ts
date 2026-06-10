// =============================================================================
// Google OAuth for the BUYER portal — a custom (non-Supabase) authorization-code
// flow so a buyer's Google login produces only a signed buyer cookie and never
// a Supabase/seller session. Server-only.
//
// One registered redirect URI (Google forbids wildcards) on the central base
// host; the originating seller host is carried through the signed `state` and
// the verified result is handed back to it (see /api/buyer/google/*).
// =============================================================================

import "server-only";

import { platformRootDomain } from "@/lib/domains";
import {
  getGoogleBuyerConfig,
  type GoogleBuyerConfig,
} from "@/lib/integration-settings";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  sub: string; // Google's stable user id
}

/** Re-export so routes can fetch the config once and pass it around. */
export { getGoogleBuyerConfig };

/** True when Google buyer login is configured (admin-saved or env creds). */
export async function buyerGoogleEnabled(): Promise<boolean> {
  const cfg = await getGoogleBuyerConfig();
  return !!(cfg.clientId && cfg.clientSecret);
}

/**
 * The single host Google redirects back to. Must exactly match the Authorized
 * redirect URI registered in Google Cloud Console. Defaults to the apex.
 */
export function buyerOAuthBaseUrl(cfg: GoogleBuyerConfig): string {
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/+$/, "");
  return `https://${platformRootDomain()}`;
}

export function buyerGoogleRedirectUri(cfg: GoogleBuyerConfig): string {
  return `${buyerOAuthBaseUrl(cfg)}/api/buyer/google/callback`;
}

/** Build the Google consent URL for a given signed state. */
export function buildGoogleAuthUrl(state: string, cfg: GoogleBuyerConfig): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId ?? "",
    redirect_uri: buyerGoogleRedirectUri(cfg),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for the buyer's verified Google profile.
 * Returns null on any failure or an unverified email (we never trust an
 * unverified Google email as a login identity).
 */
export async function exchangeCodeForProfile(
  code: string,
  cfg: GoogleBuyerConfig,
): Promise<GoogleProfile | null> {
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId ?? "",
        client_secret: cfg.clientSecret ?? "",
        redirect_uri: buyerGoogleRedirectUri(cfg),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      console.error("[buyer-google] token exchange failed", tokenRes.status);
      return null;
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return null;

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) {
      console.error("[buyer-google] userinfo failed", infoRes.status);
      return null;
    }
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
    };

    const emailVerified =
      info.email_verified === true || info.email_verified === "true";
    if (!info.email || !info.sub || !emailVerified) return null;

    return {
      email: info.email.trim().toLowerCase(),
      emailVerified: true,
      name: info.name ?? null,
      picture: info.picture ?? null,
      sub: info.sub,
    };
  } catch (e) {
    console.error("[buyer-google] exchange error", e);
    return null;
  }
}
