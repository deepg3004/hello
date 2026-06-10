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
  // A plain session token has no `t` tag. Typed tokens (oauth state / handoff)
  // must never be accepted as a session, even though they share the signer.
  if ((payload as unknown as Record<string, unknown>).t) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.e;
}

// ── Google OAuth: signed state + cross-host handoff token ────────────────────
// Buyers sign in on many hosts (*.invoxai.io + custom domains) but Google only
// allows ONE registered redirect URI, so the consent round-trip happens on a
// single central host and the verified result is handed back to the originating
// host. Both artifacts are HMAC-signed with the buyer-portal secret (no DB, no
// cookie needed across hosts) and short-lived. `t` tags prevent any one token
// type from being replayed as another.

const OAUTH_STATE_TTL_S = 10 * 60; // consent must complete within 10 min
const HANDOFF_TTL_S = 60; // host hand-back token is single-use, 60s

interface TypedPayload {
  t: "oauth_state" | "handoff";
  h?: string; // origin host (state)
  e?: string; // verified email (handoff)
  n: string; // nonce
  iat: number;
  exp: number;
}

function verifyTyped(value: string, type: TypedPayload["t"]): TypedPayload | null {
  if (typeof value !== "string" || !value.includes(".")) return null;
  const [bodyB64, sigB64] = value.split(".");
  if (!bodyB64 || !sigB64) return null;
  const expected = crypto
    .createHmac("sha256", buyerPortalSecret())
    .update(bodyB64)
    .digest("base64url");
  if (expected.length !== sigB64.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigB64))) {
      return null;
    }
  } catch {
    return null;
  }
  let payload: TypedPayload;
  try {
    payload = JSON.parse(
      Buffer.from(bodyB64, "base64url").toString("utf-8"),
    ) as TypedPayload;
  } catch {
    return null;
  }
  if (payload.t !== type) return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Sign the OAuth `state` that carries the originating host through Google. */
export function signBuyerOAuthState(host: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TypedPayload = {
    t: "oauth_state",
    h: host,
    n: crypto.randomBytes(12).toString("base64url"),
    iat: now,
    exp: now + OAUTH_STATE_TTL_S,
  };
  return signWith(JSON.stringify(payload), buyerPortalSecret());
}

/** Verify the OAuth state; returns the origin host or null. */
export function verifyBuyerOAuthState(value: string): { host: string } | null {
  const p = verifyTyped(value, "oauth_state");
  if (!p || typeof p.h !== "string" || !p.h) return null;
  return { host: p.h };
}

/** Sign the short-lived token handed back to the origin host after consent. */
export function signBuyerHandoff(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TypedPayload = {
    t: "handoff",
    e: email,
    n: crypto.randomBytes(12).toString("base64url"),
    iat: now,
    exp: now + HANDOFF_TTL_S,
  };
  return signWith(JSON.stringify(payload), buyerPortalSecret());
}

/** Verify the handoff token; returns the verified email or null. */
export function verifyBuyerHandoff(value: string): string | null {
  const p = verifyTyped(value, "handoff");
  if (!p || typeof p.e !== "string" || !p.e) return null;
  return p.e;
}
