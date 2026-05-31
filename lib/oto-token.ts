// HMAC-signed cookie for the post-purchase OTO redirect. We don't need a
// full JWT lib — a base64(payload).base64(sig) string is enough for our
// 15-minute use case.
//
// Cookie name: `invoxai_oto`
// Payload: { order_id, page_id, slug, exp }
// Lifetime: 15 minutes
//
// Lives server-side only — depends on node:crypto.

import crypto from "node:crypto";

export const OTO_COOKIE_NAME = "invoxai_oto";
export const OTO_TTL_SECONDS = 15 * 60;

export interface OtoPayload {
  order_id: string;
  page_id: string;
  slug: string;
  exp: number; // unix seconds
  /** Random token id — recorded in oto_token_consumed so a cookie can only
   *  be redeemed once. Older tokens minted before this field existed will
   *  fail verifyOtoToken() and the buyer is asked to refresh — acceptable
   *  given the 15-minute TTL. */
  jti: string;
}

function getSecret(): string {
  const s = process.env.OTO_SECRET;
  if (!s || s.length < 16) {
    throw new Error("OTO_SECRET must be set (32+ chars).");
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  const s = (typeof buf === "string" ? Buffer.from(buf) : buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return s;
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signOtoToken(
  payload: Omit<OtoPayload, "exp" | "jti">,
): string {
  const full: OtoPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + OTO_TTL_SECONDS,
    jti: crypto.randomBytes(16).toString("hex"),
  };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyOtoToken(token: string): OtoPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = b64url(
      crypto.createHmac("sha256", getSecret()).update(body).digest(),
    );
  } catch {
    return null;
  }
  // Timing-safe compare
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }

  let payload: OtoPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as OtoPayload;
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.order_id || !payload.page_id || !payload.slug) return null;
  if (!payload.jti || payload.jti.length < 16) return null;
  return payload;
}
