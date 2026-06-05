// Cashfree PG driver (API version 2023-08-01), raw fetch — no SDK.
// NOTE: backend-complete but UNVERIFIED against sandbox; the buyer flow uses
// Cashfree's `payment_session_id` + their JS SDK, which the checkout frontend
// does not yet implement. Do not route live checkout here until tested.

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

const BASE = process.env.CASHFREE_API_BASE ?? "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";

function authHeaders(keys: GatewayKeys): Record<string, string> {
  return {
    "x-client-id": keys.key_id,
    "x-client-secret": keys.key_secret,
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
  };
}

export const cashfreeGateway: PaymentGateway = {
  type: "cashfree",

  async createOrder(keys, input): Promise<CreateOrderResult> {
    const res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: authHeaders(keys),
      body: JSON.stringify({
        order_id: input.receipt,
        order_amount: Number((input.amountPaise / 100).toFixed(2)),
        order_currency: input.currency ?? "INR",
        order_note: Object.values(input.notes ?? {}).join(" ").slice(0, 200) || undefined,
        customer_details: {
          customer_id: input.customer?.email || input.receipt,
          customer_email: input.customer?.email || "buyer@example.com",
          customer_phone: input.customer?.phone || "9999999999",
          customer_name: input.customer?.name,
        },
      }),
    });
    const json = (await res.json()) as { payment_session_id?: string; order_id?: string; message?: string };
    if (!res.ok || !json.payment_session_id) {
      throw new Error(`Cashfree createOrder failed: ${json.message ?? res.status}`);
    }
    return {
      providerOrderId: json.order_id ?? input.receipt,
      client: { paymentSessionId: json.payment_session_id, mode: BASE.includes("sandbox") ? "sandbox" : "production" },
      raw: json,
    };
  },

  // Cashfree has no in-checkout signature; verify by fetching the order status.
  async verifyPayment(keys, input: VerifyPaymentInput): Promise<boolean> {
    const status = await this.getPaymentStatus!(keys, input.orderId);
    return status === "PAID";
  },

  // x-webhook-signature = base64( HMAC_SHA256( timestamp + rawBody, secret ) ).
  verifyWebhookSignature(rawBody, headers, keys): boolean {
    const sig = header(headers, "x-webhook-signature");
    const ts = header(headers, "x-webhook-timestamp");
    const secret = keys.webhook_secret || keys.key_secret;
    if (!sig || !ts || !secret) return false;
    const expected = crypto.createHmac("sha256", secret).update(ts + rawBody).digest("base64");
    return expected.length === sig.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  },

  async refund(keys, input: RefundInput): Promise<RefundResult> {
    // Cashfree refunds are keyed by ORDER id; we pass the order id via paymentId.
    const refundId = `rf_${input.paymentId}_${Math.floor(input.amountPaise ?? 0)}`.slice(0, 40);
    const res = await fetch(`${BASE}/orders/${encodeURIComponent(input.paymentId)}/refunds`, {
      method: "POST",
      headers: authHeaders(keys),
      body: JSON.stringify({
        refund_id: refundId,
        ...(input.amountPaise ? { refund_amount: Number((input.amountPaise / 100).toFixed(2)) } : {}),
        refund_note: "Refund",
      }),
    });
    const json = (await res.json()) as { cf_refund_id?: string | number; refund_status?: string; message?: string };
    if (!res.ok) throw new Error(`Cashfree refund failed: ${json.message ?? res.status}`);
    return { refundId: String(json.cf_refund_id ?? refundId), status: json.refund_status ?? "PENDING" };
  },

  async getPaymentStatus(keys, orderId: string): Promise<string> {
    const res = await fetch(`${BASE}/orders/${encodeURIComponent(orderId)}`, {
      headers: authHeaders(keys),
    });
    const json = (await res.json()) as { order_status?: string };
    return json.order_status ?? "UNKNOWN";
  },

  async testConnection(keys): Promise<TestResult> {
    try {
      const res = await fetch(`${BASE}/orders/__invoxai_conn_test__`, { headers: authHeaders(keys) });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "Cashfree rejected the credentials." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
};
