// HMAC-signed unlock token for "Lock Content" pages (buyers have no accounts).
// Mirrors lib/course-token.ts: base64url(payload).base64url(sig). Binds a paid
// order to a page so /unlock/[pageId] can authorise without a login. Server-only.

import crypto from "node:crypto";

export const CONTENT_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

export interface ContentPayload {
  page_id: string;
  order_id: string;
  email: string;
  exp: number; // unix seconds
}

function getSecret(): string {
  // Reuse an existing server secret so no new env var is required (same source
  // as course-token, kept independent so the two token kinds don't collide).
  const s =
    process.env.CONTENT_TOKEN_SECRET ??
    process.env.COURSE_TOKEN_SECRET ??
    process.env.OTO_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s || s.length < 16) {
    throw new Error("No secret available for content token signing.");
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return (typeof buf === "string" ? Buffer.from(buf) : buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signContentToken(payload: Omit<ContentPayload, "exp">): string {
  const full: ContentPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + CONTENT_TOKEN_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyContentToken(token: string): ContentPayload | null {
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
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }

  let payload: ContentPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as ContentPayload;
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.page_id || !payload.order_id) return null;
  return payload;
}
