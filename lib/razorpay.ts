// =============================================================================
// Razorpay server-side client + webhook signature verification.
// NEVER import this from a client component.
// =============================================================================

import crypto from "node:crypto";
import Razorpay from "razorpay";

let cached: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (cached) return cached;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
  }
  cached = new Razorpay({ key_id, key_secret });
  return cached;
}

/**
 * Verify a Razorpay webhook signature. Returns true if the signature in the
 * `X-Razorpay-Signature` header matches the HMAC-SHA256 of the raw body using
 * RAZORPAY_WEBHOOK_SECRET.
 *
 * IMPORTANT: pass the raw request body string, not the parsed JSON.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Length-safe compare to avoid timing leaks.
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader),
  );
}
