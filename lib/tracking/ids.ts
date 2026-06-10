// Phase 15 tracking — cookie names + small helpers for visitor/session
// identity and user-agent classification. No PII: a visitor_id is a random
// opaque id, not tied to a person until they log in / purchase elsewhere.

export const VISITOR_COOKIE = "invox_vid";
export const SESSION_COOKIE = "invox_sid";

/** Visitor cookie lives ~1y; session cookie ~30 min of inactivity. */
export const VISITOR_TTL_SECONDS = 365 * 24 * 3600;
export const SESSION_TTL_SECONDS = 30 * 60;

export function newTrackingId(): string {
  // crypto.randomUUID exists in Node 18+ and the Edge runtime.
  try {
    return crypto.randomUUID();
  } catch {
    // Extremely defensive fallback (should never run in our runtimes).
    return `v_${Date.now().toString(36)}${Math.round(Math.random() * 1e9).toString(36)}`;
  }
}

export type DeviceType = "mobile" | "tablet" | "desktop";

export function deviceFromUA(ua: string | null | undefined): DeviceType {
  const s = (ua ?? "").toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return "mobile";
  return "desktop";
}

export function browserFromUA(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (/edg\//i.test(s)) return "Edge";
  if (/opr\/|opera/i.test(s)) return "Opera";
  if (/chrome|crios/i.test(s) && !/edg\//i.test(s)) return "Chrome";
  if (/firefox|fxios/i.test(s)) return "Firefox";
  if (/safari/i.test(s) && !/chrome|crios/i.test(s)) return "Safari";
  return "Other";
}
