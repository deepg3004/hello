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
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
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
  const payload = `${args.razorpay_order_id}|${args.razorpay_payment_id}`;
  return timingSafeHmacEq(payload, args.razorpay_signature, secret);
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

// ----------------------------------------------------------------------------
// Payouts (seller withdrawals from platform escrow)
// ----------------------------------------------------------------------------

export interface CreatePayoutArgs {
  /** RazorpayX account number that funds the payout. */
  account_number: string;
  /** Fund account id (`fa_XXXX`) created from the seller's bank/UPI. */
  fund_account_id: string;
  /** Amount in PAISE. */
  amount: number;
  currency?: string;
  /** "IMPS" | "NEFT" | "RTGS" | "UPI" */
  mode?: "IMPS" | "NEFT" | "RTGS" | "UPI";
  /** "payout" | "payout_link" */
  purpose?: "payout" | "refund" | "cashback" | "salary";
  /** Idempotency key, ideally our internal payout id. */
  reference_id?: string;
  narration?: string;
  notes?: Record<string, string>;
}

/**
 * Create a RazorpayX payout. Used for seller withdrawals when funds aren't
 * routed automatically (e.g. before linked account is set up).
 */
export async function createPayout(args: CreatePayoutArgs) {
  // razorpay-node exposes payouts via `razorpay.payouts.create`, but Route is
  // configured at the API layer — go through fetch to keep options stable.
  const key_id = process.env.RAZORPAY_KEY_ID!;
  const key_secret = process.env.RAZORPAY_KEY_SECRET!;
  const auth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/payouts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
      "X-Payout-Idempotency": args.reference_id ?? crypto.randomUUID(),
    },
    body: JSON.stringify({
      account_number: args.account_number,
      fund_account_id: args.fund_account_id,
      amount: args.amount,
      currency: args.currency ?? "INR",
      mode: args.mode ?? "IMPS",
      purpose: args.purpose ?? "payout",
      reference_id: args.reference_id,
      narration: args.narration ?? "InvoxAI seller payout",
      notes: args.notes,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay payout failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ----------------------------------------------------------------------------
// Transfers (post-capture money movement to a linked account)
// ----------------------------------------------------------------------------

export interface CreateTransferArgs {
  /** Source payment id (`pay_XXXX`). */
  payment_id: string;
  /** Destination linked account (`acc_XXXX`). */
  account: string;
  /** Amount in PAISE. */
  amount: number;
  currency?: string;
  notes?: Record<string, string>;
  on_hold?: 0 | 1;
}

/**
 * Create a Razorpay Route transfer from a captured payment to a linked
 * account. Use when the order didn't include the split up front.
 */
export async function createTransfer(args: CreateTransferArgs) {
  const razorpay = getRazorpay();
  return razorpay.payments.transfer(args.payment_id, {
    transfers: [
      {
        account: args.account,
        amount: args.amount,
        currency: args.currency ?? "INR",
        notes: args.notes,
        on_hold: args.on_hold ?? 0,
      },
    ],
  } as unknown as Parameters<typeof razorpay.payments.transfer>[1]);
}

// ----------------------------------------------------------------------------
// Linked account (Route seller onboarding)
// ----------------------------------------------------------------------------

export interface CreateLinkedAccountArgs {
  email: string;
  /** Seller's legal/full name — used as account holder name fallback. */
  name: string;
  /** Phone in international format. */
  contact?: string;
  business_name: string;
  /** Bank account details. */
  bank: {
    account_number: string;
    ifsc_code: string;
    beneficiary_name: string;
  };
  /** Address for KYC. Razorpay Route requires these for activation. */
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  /** Free-form metadata. */
  notes?: Record<string, string>;
}

/**
 * Create a Razorpay Route linked account. The returned account id (`acc_XXX`)
 * is what we pass in order `transfers[].account` to credit the seller.
 *
 * Uses the V2 Accounts API. Note: your Razorpay account must have Route /
 * Marketplace enabled — otherwise this 403s.
 */
export async function createLinkedAccount(args: CreateLinkedAccountArgs) {
  const key_id = process.env.RAZORPAY_KEY_ID!;
  const key_secret = process.env.RAZORPAY_KEY_SECRET!;
  const auth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");

  const body = {
    email: args.email,
    phone: args.contact,
    type: "route",
    reference_id: `invoxai_${Date.now()}`,
    legal_business_name: args.business_name,
    business_type: "individual",
    contact_name: args.name,
    profile: {
      category: "ecommerce",
      subcategory: "digital_goods",
      addresses: args.address
        ? {
            registered: {
              street1: args.address.street1 ?? "",
              street2: args.address.street2 ?? "",
              city: args.address.city ?? "",
              state: args.address.state ?? "",
              postal_code: args.address.postal_code ?? "",
              country: args.address.country ?? "IN",
            },
          }
        : undefined,
    },
    notes: args.notes,
  };

  const res = await fetch("https://api.razorpay.com/v2/accounts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay linked account create failed: ${res.status} ${text}`);
  }
  const account = (await res.json()) as { id: string };

  // Attach the seller's bank account as the fund account for payouts.
  // This is a second call; failure here doesn't roll back the account itself.
  try {
    await fetch(`https://api.razorpay.com/v1/contacts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        name: args.bank.beneficiary_name,
        email: args.email,
        contact: args.contact,
        type: "vendor",
        reference_id: `invoxai_${account.id}`,
        notes: { invoxai_account: account.id },
      }),
    });
  } catch {
    // best-effort — surface in logs but don't fail the create
  }

  return account;
}
