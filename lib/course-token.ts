// HMAC-signed course-access token (buyers have no accounts). Mirrors the
// oto-token pattern: base64(payload).base64(sig). Binds a buyer's order to a
// course so the student player can authorise without a login. Server-only.

import crypto from "node:crypto";

export const COURSE_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

export interface CoursePayload {
  course_id: string;
  order_id: string;
  email: string;
  exp: number; // unix seconds
}

function getSecret(): string {
  // Reuse an existing server secret so no new env var is required.
  const s =
    process.env.COURSE_TOKEN_SECRET ??
    process.env.OTO_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s || s.length < 16) {
    throw new Error("No secret available for course token signing.");
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

export function signCourseToken(
  payload: Omit<CoursePayload, "exp">,
): string {
  const full: CoursePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + COURSE_TOKEN_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

// ── Free-preview tokens ─────────────────────────────────────────────────────
// A short-lived token that authorises ONLY a course's free-preview lessons (no
// order/enrollment). Separate shape from CoursePayload so an enrollment check
// (which requires order_id) never accepts one of these, and vice-versa.

export const PREVIEW_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export interface PreviewPayload {
  course_id: string;
  preview: true;
  exp: number;
}

export function signPreviewToken(courseId: string): string {
  const full: PreviewPayload = {
    course_id: courseId,
    preview: true,
    exp: Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyPreviewToken(token: string): PreviewPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: string;
  try {
    expected = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  } catch {
    return null;
  }
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload: PreviewPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as PreviewPayload;
  } catch {
    return null;
  }
  if (payload.preview !== true) return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.course_id) return null;
  return payload;
}

export function verifyCourseToken(token: string): CoursePayload | null {
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

  let payload: CoursePayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as CoursePayload;
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.course_id || !payload.order_id) return null;
  return payload;
}
