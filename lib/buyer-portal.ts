// =============================================================================
// Buyer portal — passwordless (email OTP) login primitives. Server-only.
//
// Mirrors the proven affiliate-portal flow (lib/affiliate.ts) but with a
// SEPARATE cookie + secrets so a buyer session and an affiliate/seller session
// can never be confused or cross-granted. A buyer logs in at /account with a
// 6-digit code mailed to the email they bought with, then sees every order,
// course, Telegram membership and invoice tied to that email across all sellers.
// =============================================================================

import "server-only";

import crypto from "node:crypto";

export const BUYER_COOKIE = "invoxai_buyer";
export const BUYER_COOKIE_TTL_DAYS = 14;

const DEV_OTP_SALT_FALLBACK = "invoxai_buyer_otp_v1";
const DEV_PORTAL_SECRET_FALLBACK = "invoxai_buyer_portal_dev";

function buyerOtpSalt(): string {
  const salt = process.env.BUYER_OTP_SALT;
  if (salt && salt.length >= 16) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BUYER_OTP_SALT must be set (>=16 chars) in production.");
  }
  return DEV_OTP_SALT_FALLBACK;
}

function buyerPortalSecret(): string {
  const secret = process.env.BUYER_PORTAL_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BUYER_PORTAL_SECRET must be set (>=16 chars) in production.",
    );
  }
  return DEV_PORTAL_SECRET_FALLBACK;
}

// ── OTP ─────────────────────────────────────────────────────────────────────
export function generateBuyerOtp(length = 6): string {
  const max = 10 ** length;
  const n = crypto.randomBytes(4).readUInt32BE(0) % max;
  return String(n).padStart(length, "0");
}

export function hashBuyerOtp(otp: string): string {
  return crypto
    .createHmac("sha256", buyerOtpSalt())
    .update(otp.trim())
    .digest("hex");
}

// ── Session cookie (signed, with embedded expiry) ───────────────────────────
interface BuyerPayload {
  e: string; // email
  iat: number;
  exp: number;
}

function signWith(body: string, secret: string): string {
  const bodyB64 = Buffer.from(body).toString("base64url");
  const mac = crypto
    .createHmac("sha256", secret)
    .update(bodyB64)
    .digest("base64url");
  return `${bodyB64}.${mac}`;
}

export function signBuyerSession(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: BuyerPayload = {
    e: email,
    iat: now,
    exp: now + BUYER_COOKIE_TTL_DAYS * 24 * 60 * 60,
  };
  return signWith(JSON.stringify(payload), buyerPortalSecret());
}

/** Verify a buyer session cookie. Returns the email or null if invalid/expired. */
export function verifyBuyerSession(value: string): string | null {
  if (typeof value !== "string" || !value.includes(".")) return null;
  const [bodyB64, sigB64] = value.split(".");
  if (!bodyB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac("sha256", buyerPortalSecret())
    .update(bodyB64)
    .digest("base64url");
  if (expectedSig.length !== sigB64.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigB64))) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: BuyerPayload;
  try {
    payload = JSON.parse(
      Buffer.from(bodyB64, "base64url").toString("utf-8"),
    ) as BuyerPayload;
  } catch {
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
