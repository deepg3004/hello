// =============================================================================
// Affiliate / referral helpers.
//
// Pure functions + shared types. Safe to import from client (commission
// computation appears on the seller dashboard preview) and server (verify-
// payment uses it to mint payout rows).
// =============================================================================

import crypto from "node:crypto";

export type CommissionType = "percentage" | "fixed";
export type AffiliateProgramStatus = "active" | "paused";

export interface AffiliateProgram {
  commission_type: CommissionType;
  commission_value: number;
  status: AffiliateProgramStatus;
}

/**
 * Compute the affiliate's commission for a single order. Percentages cap
 * at the order amount so a misconfigured 200% commission can't pay the
 * affiliate more than the seller earned.
 */
export function computeCommission(
  program: AffiliateProgram,
  orderAmount: number,
): number {
  const amount = Math.max(0, Number(orderAmount ?? 0));
  if (amount === 0) return 0;
  if (program.commission_type === "percentage") {
    const pct = Math.max(0, Math.min(100, Number(program.commission_value)));
    return round2((amount * pct) / 100);
  }
  // Fixed — never more than the order itself.
  return round2(Math.min(Number(program.commission_value), amount));
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

// ── Referral cookie names ────────────────────────────────────────────────

/** 30-day cookie carrying the referral code on a per-page basis so cross-
 *  selling between sellers doesn't poison attribution. */
export function refCookieName(slug: string): string {
  return `ref_${slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export const REF_COOKIE_TTL_DAYS = 30;

// ── Portal session cookie ────────────────────────────────────────────────

export const PORTAL_COOKIE = "invoxai_affiliate";
export const PORTAL_COOKIE_TTL_DAYS = 14;

// ── OTP helpers (server-only) ────────────────────────────────────────────

export function generatePortalOtp(length = 6): string {
  const max = 10 ** length;
  const buf = crypto.randomBytes(4).readUInt32BE(0) % max;
  return String(buf).padStart(length, "0");
}

const DEV_OTP_SALT_FALLBACK = "invoxai_aff_otp_v1";
const DEV_PORTAL_SECRET_FALLBACK = "invoxai_aff_portal_dev";

function affiliateOtpSalt(): string {
  const salt = process.env.AFFILIATE_OTP_SALT;
  if (salt && salt.length >= 16) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AFFILIATE_OTP_SALT must be set (>=16 chars) in production.",
    );
  }
  return DEV_OTP_SALT_FALLBACK;
}

function affiliatePortalSecret(): string {
  const secret = process.env.AFFILIATE_PORTAL_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AFFILIATE_PORTAL_SECRET must be set (>=16 chars) in production.",
    );
  }
  return DEV_PORTAL_SECRET_FALLBACK;
}

export function hashPortalOtp(otp: string): string {
  return crypto
    .createHmac("sha256", affiliateOtpSalt())
    .update(otp.trim())
    .digest("hex");
}

// ── Portal session token (with embedded expiry) ─────────────────────────────
//
// SECURITY: previously the cookie value was `b64(email).b64(hmac)` with NO
// expiry claim — a stolen cookie was valid forever because there was no
// server-side revocation. Now we embed { e: email, exp: unix-seconds } in
// the signed payload and verify against the wall clock. A stolen cookie
// stops working after `PORTAL_COOKIE_TTL_DAYS` regardless of whether the
// underlying secret has been rotated.
//
// Migration: old `b64(email)` payloads fail JSON.parse below and are
// rejected — affiliates re-OTP and get a new dated session. Clean break
// vs. silently accepting unbounded old tokens.

interface PortalPayload {
  /** Email — kept short to limit cookie size. */
  e: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expiry, unix seconds. */
  exp: number;
}

/** Sign an email into the portal session cookie value. Embeds a 14-day exp. */
export function signPortalSession(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: PortalPayload = {
    e: email,
    iat: now,
    exp: now + PORTAL_COOKIE_TTL_DAYS * 24 * 60 * 60,
  };
  return signWith(JSON.stringify(payload), affiliatePortalSecret());
}

/** Verify a portal session cookie. Returns the email or null if invalid/expired. */
export function verifyPortalSession(value: string): string | null {
  if (typeof value !== "string" || !value.includes(".")) return null;
  const [bodyB64, sigB64] = value.split(".");
  if (!bodyB64 || !sigB64) return null;

  // Recompute the signature on the unverified payload and compare.
  const expectedSig = crypto
    .createHmac("sha256", affiliatePortalSecret())
    .update(bodyB64)
    .digest("base64url");
  if (expectedSig.length !== sigB64.length) return null;
  try {
    if (
      !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigB64))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  // Parse the now-trusted payload + check expiry.
  let payload: PortalPayload;
  try {
    payload = JSON.parse(
      Buffer.from(bodyB64, "base64url").toString("utf-8"),
    ) as PortalPayload;
  } catch {
    // Old `b64(email)` format that pre-dates the exp claim — reject so the
    // affiliate re-OTPs and gets a dated session.
    return null;
  }
  if (
    !payload.e ||
    typeof payload.e !== "string" ||
    !payload.exp ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.e;
}

function signWith(body: string, secret: string): string {
  const bodyB64 = Buffer.from(body).toString("base64url");
  const mac = crypto
    .createHmac("sha256", secret)
    .update(bodyB64)
    .digest("base64url");
  return `${bodyB64}.${mac}`;
}

// ── Referral code ────────────────────────────────────────────────────────

/** 10-char URL-safe code: short enough to share, large enough to dodge
 *  guess attacks (62^10 = 8e17 possibilities). */
export function mintReferralCode(): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}
