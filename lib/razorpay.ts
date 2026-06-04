// =============================================================================
// Razorpay server-side client + helpers.
//
// NEVER import this from a client component. All public surface area requires
// RAZORPAY_KEY_SECRET, which lives only on the server.
// =============================================================================

import crypto from "node:crypto";
import Razorpay from "razorpay";

// ----------------------------------------------------------------------------
// Singleton SDK client
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Signature verification
// ----------------------------------------------------------------------------

/** Verify a Razorpay webhook signature against RAZORPAY_WEBHOOK_SECRET. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  return verifyWebhookSignatureWithSecret(
    rawBody,
    signatureHeader,
    process.env.RAZORPAY_WEBHOOK_SECRET,
  );
}

/**
 * Verify a Razorpay webhook signature against an explicit secret — used for
 * the seller-gateway webhook (Phase 4), where each seller's payments are signed
 * with that seller's own webhook secret (seller_gateway_config.webhook_secret_enc).
 */
export function verifyWebhookSignatureWithSecret(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !signatureHeader) return false;
  return timingSafeHmacEq(rawBody, signatureHeader, secret);
}

/**
 * Verify the in-checkout payment signature returned by Razorpay Checkout:
 *   HMAC_SHA256(RAZORPAY_KEY_SECRET, `${order_id}|${payment_id}`)
 *
 * Used by /api/checkout/verify-payment.
 */
export function verifyPayment(args: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  return verifyPaymentWithSecret(args, secret);
}

/**
 * Same as verifyPayment but against an explicit key secret — used when an order
 * was created on a SELLER's own gateway (Phase 4, multi-gateway checkout), so
 * the signature must be checked with the seller's secret, not the platform's.
 */
export function verifyPaymentWithSecret(
  args: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
  secret: string,
): boolean {
  if (!secret) return false;
  const payload = `${args.razorpay_order_id}|${args.razorpay_payment_id}`;
  return timingSafeHmacEq(payload, args.razorpay_signature, secret);
}

/**
 * Create a Razorpay order on an arbitrary key pair (a seller's own gateway).
 * No Route transfers — in seller-gateway mode the full amount lands in the
 * seller's account and InvoxAI's revenue is collected via the wallet fee.
 */
export async function createOrderOnKeys(
  keys: { key_id: string; key_secret: string },
  args: { amount: number; currency?: string; receipt?: string; notes?: Record<string, string> },
) {
  const client = new Razorpay({
    key_id: keys.key_id,
    key_secret: keys.key_secret,
  });
  const body = {
    amount: args.amount,
    currency: args.currency ?? "INR",
    receipt: args.receipt,
    notes: args.notes,
    payment_capture: 1,
  };
  return client.orders.create(
    body as unknown as Parameters<typeof client.orders.create>[0],
  );
}

function timingSafeHmacEq(
  payload: string,
  providedHex: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  if (expected.length !== providedHex.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(providedHex),
  );
}

// ----------------------------------------------------------------------------
// Order creation with optional Razorpay Route transfers
// ----------------------------------------------------------------------------

export interface RouteTransfer {
  /** Linked account id (acc_XXXXXXXXXXXXXX). */
  account: string;
  /** Amount in PAISE that the linked account should receive. */
  amount: number;
  currency?: string;
  /** 0 = release on capture (default); 1 = hold until manual release. */
  on_hold?: 0 | 1;
  notes?: Record<string, string>;
}

export interface CreateOrderArgs {
  /** Gross amount in PAISE. */
  amount: number;
  currency?: string;
  /** Our internal short_id / order id — Razorpay echoes this back as `receipt`. */
  receipt?: string;
  /** Free-form metadata persisted on the Razorpay order object. */
  notes?: Record<string, string>;
  /** Route splits — at least one transfer to the seller, optionally more. */
  transfers?: RouteTransfer[];
}

/**
 * Create a Razorpay order. When `transfers` is provided, configures a Route
 * split so the seller's linked account is credited automatically on capture.
 */
export async function createOrder(args: CreateOrderArgs) {
  const razorpay = getRazorpay();
  const body: Record<string, unknown> = {
    amount: args.amount,
    currency: args.currency ?? "INR",
    receipt: args.receipt,
    notes: args.notes,
    payment_capture: 1,
  };
  if (args.transfers && args.transfers.length > 0) {
    body.transfers = args.transfers.map((t) => ({
      account: t.account,
      amount: t.amount,
      currency: t.currency ?? "INR",
      on_hold: t.on_hold ?? 0,
      notes: t.notes,
    }));
  }
  // Cast — razorpay-node's TS types don't model `transfers` on orders.create.
  return razorpay.orders.create(body as unknown as Parameters<typeof razorpay.orders.create>[0]);
}

// Seller payouts, Route transfers & linked accounts removed (Sessions 2 & 3):
// InvoxAI holds no funds — no RazorpayX payouts, no post-capture transfers, no
// Route linked-account onboarding. Sellers collect directly via their OWN
// gateway; InvoxAI's only revenue is the per-order wallet fee (migration 040).
