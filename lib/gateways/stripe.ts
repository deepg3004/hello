// Stripe driver via raw REST API (no SDK dependency). key_id = publishable key
// (pk_), key_secret = secret key (sk_), webhook_secret = signing secret (whsec_).
// BACKEND-COMPLETE BUT UNVERIFIED; buyer flow uses PaymentIntent client_secret +
// Stripe.js, not yet wired in the checkout frontend.

import crypto from "node:crypto";

import type { GatewayKeys } from "@/lib/gateway-loader";
import {
  header,
  type PaymentGateway,
  type CreateOrderInput,
  type CreateOrderResult,
  type VerifyPaymentInput,
  type RefundInput,
  type RefundResult,
  type TestResult,
} from "@/lib/gateways/types";

const BASE = "https://api.stripe.com/v1";

async function stripe(
  keys: GatewayKeys,
  path: string,
  method: "GET" | "POST",
  form?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${keys.key_secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export const stripeGateway: PaymentGateway = {
  type: "stripe",

  async createOrder(keys, input: CreateOrderInput): Promise<CreateOrderResult> {
    const { ok, json } = await stripe(keys, "/payment_intents", "POST", {
      amount: String(input.amountPaise),
      currency: (input.currency ?? "INR").toLowerCase(),
      "metadata[receipt]": input.receipt,
      ...(input.customer?.email ? { receipt_email: input.customer.email } : {}),
      "automatic_payment_methods[enabled]": "true",
    });
    if (!ok || !json.client_secret) {
      throw new Error(`Stripe createOrder failed: ${(json.error as { message?: string })?.message ?? "error"}`);
    }
    return {
      providerOrderId: String(json.id),
      client: { clientSecret: String(json.client_secret), publishableKey: keys.key_id },
      raw: json,
    };
  },

  async verifyPayment(keys, input: VerifyPaymentInput): Promise<boolean> {
    const status = await this.getPaymentStatus!(keys, input.orderId);
    return status === "succeeded";
  },

  // Stripe-Signature: t=<ts>,v1=<hmacSHA256(`${t}.${rawBody}`, whsec)>
  verifyWebhookSignature(rawBody, headers, keys): boolean {
    const secret = keys.webhook_secret;
    const sigHeader = header(headers, "stripe-signature");
    if (!secret || !sigHeader) return false;
    const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=") as [string, string]));
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    return expected.length === v1.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  },

  async refund(keys, input: RefundInput): Promise<RefundResult> {
    const { ok, json } = await stripe(keys, "/refunds", "POST", {
      payment_intent: input.paymentId,
      ...(input.amountPaise ? { amount: String(input.amountPaise) } : {}),
    });
    if (!ok || !json.id) throw new Error(`Stripe refund failed: ${(json.error as { message?: string })?.message ?? "error"}`);
    return { refundId: String(json.id), status: String(json.status ?? "pending") };
  },

  async getPaymentStatus(keys, paymentIntentId: string): Promise<string> {
    const { json } = await stripe(keys, `/payment_intents/${encodeURIComponent(paymentIntentId)}`, "GET");
    return String(json.status ?? "unknown");
  },

  async testConnection(keys): Promise<TestResult> {
    try {
      const { ok, status } = await stripe(keys, "/balance", "GET");
      return ok ? { ok: true } : { ok: false, message: status === 401 ? "Stripe rejected the secret key." : `Stripe error ${status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
};
