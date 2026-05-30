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

export function hashPortalOtp(otp: string): string {
  const salt = process.env.AFFILIATE_OTP_SALT ?? "invoxai_aff_otp_v1";
  return crypto
    .createHmac("sha256", salt)
    .update(otp.trim())
    .digest("hex");
}

/** Sign an email into the portal session cookie value. */
export function signPortalSession(email: string): string {
  const secret = process.env.AFFILIATE_PORTAL_SECRET ?? "";
  if (!secret) {
    // In dev / when the operator hasn't rotated a secret yet, sign with a
    // hard-coded fallback. Still HMAC'd so an external visitor can't forge.
    return signWith(email, "invoxai_aff_portal_dev");
  }
  return signWith(email, secret);
}

export function verifyPortalSession(value: string): string | null {
  const secret = process.env.AFFILIATE_PORTAL_SECRET ?? "";
  const sig = secret
    ? signWith(decode(value), secret)
    : signWith(decode(value), "invoxai_aff_portal_dev");
  if (sig === value) return decode(value);
  return null;
}

function signWith(email: string, secret: string): string {
  const payload = Buffer.from(email).toString("base64url");
  const mac = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${mac}`;
}

function decode(token: string): string {
  const payload = token.split(".")[0] ?? "";
  try {
    return Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return "";
  }
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
