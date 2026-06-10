// =============================================================================
// Password gate for builder pages (migration 092). Server-only.
//
// The unlock cookie value is an HMAC of the page id + its current password, so
// it needs no stored session state AND auto-invalidates the moment the seller
// changes the password (the HMAC no longer matches). The page password itself
// is never sent to the browser — only this derived token.
// =============================================================================

import "server-only";

import crypto from "node:crypto";

function secret(): string {
  return process.env.OTO_SECRET || "invoxai_builder_unlock_dev";
}

/** Cookie name carrying the unlock token for a specific page. */
export function unlockCookieName(pageId: string): string {
  return `bpu_${pageId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

/** Derive the unlock token for (pageId, password). */
export function unlockToken(pageId: string, password: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${pageId}:${password}`)
    .digest("base64url");
}

/** True when `cookieValue` proves the visitor entered the page's current password. */
export function isUnlocked(
  pageId: string,
  password: string,
  cookieValue: string | undefined,
): boolean {
  if (!password) return true; // page isn't gated
  if (!cookieValue) return false;
  const expected = unlockToken(pageId, password);
  if (expected.length !== cookieValue.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cookieValue));
  } catch {
    return false;
  }
}
