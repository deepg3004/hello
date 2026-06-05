// Instamojo driver (API v1.1). key_id = X-Api-Key, key_secret = X-Auth-Token,
// webhook_secret = salt (for the webhook MAC). BACKEND-COMPLETE BUT UNVERIFIED;
// buyer flow is a redirect to `longurl`, not yet wired in the frontend.

import crypto from "node:crypto";

import type { GatewayKeys } from "@/lib/gateway-loader";
import {
  type PaymentGateway,
  type CreateOrderInput,
  type CreateOrderResult,
  type VerifyPaymentInput,
  type RefundInput,
  type RefundResult,
  type TestResult,
} from "@/lib/gateways/types";

const BASE = process.env.INSTAMOJO_API_BASE ?? "https://www.instamojo.com/api/1.1";

function authHeaders(keys: GatewayKeys): Record<string, string> {
  return { "X-Api-Key": keys.key_id, "X-Auth-Token": keys.key_secret };
}

export const instamojoGateway: PaymentGateway = {
  type: "instamojo",

  async createOrder(keys, input: CreateOrderInput): Promise<CreateOrderResult> {
    const body = new URLSearchParams({
      purpose: (Object.values(input.notes ?? {}).join(" ") || "Order").slice(0, 100),
      amount: (input.amountPaise / 100).toFixed(2),
      buyer_name: input.customer?.name ?? "",
      email: input.customer?.email ?? "",
      phone: input.customer?.phone ?? "",
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/order`,
      send_email: "false",
      allow_repeated_payments: "false",
    });
    const res = await fetch(`${BASE}/payment-requests/`, {
      method: "POST",
      headers: { ...authHeaders(keys), "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean; payment_request?: { id: string; longurl: string }; message?: string };
    if (!res.ok || !json.success || !json.payment_request) {
      throw new Error(`Instamojo createOrder failed: ${json.message ?? res.status}`);
    }
    return {
      providerOrderId: json.payment_request.id,
      client: { redirectUrl: json.payment_request.longurl },
      raw: json,
    };
  },

  async verifyPayment(keys, input: VerifyPaymentInput): Promise<boolean> {
    const res = await fetch(`${BASE}/payment-requests/${encodeURIComponent(input.orderId)}/`, {
      headers: authHeaders(keys),
    });
    const json = (await res.json()) as { payment_request?: { status?: string; payments?: Array<{ status?: string }> } };
    const pr = json.payment_request;
    const paid = pr?.status === "Completed" || (pr?.payments ?? []).some((p) => p.status === "Credit");
    return !!paid;
  },

  // Instamojo webhook MAC = HMAC-SHA1 of the values sorted by key, joined by "|".
  verifyWebhookSignature(rawBody, _headers, keys): boolean {
    const salt = keys.webhook_secret || keys.key_secret;
    if (!salt) return false;
    try {
      const params = new URLSearchParams(rawBody);
      const obj: Record<string, string> = {};
      params.forEach((v, k) => (obj[k] = v));
      const provided = obj.mac ?? "";
      delete obj.mac;
      const message = Object.keys(obj).sort().map((k) => obj[k]).join("|");
      const expected = crypto.createHmac("sha1", salt).update(message).digest("hex");
      return expected.length === provided.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  },

  async refund(keys, input: RefundInput): Promise<RefundResult> {
    const body = new URLSearchParams({
      payment_id: input.paymentId,
      type: "RFD",
      body: "Refund",
      ...(input.amountPaise ? { refund_amount: (input.amountPaise / 100).toFixed(2) } : {}),
    });
    const res = await fetch(`${BASE}/refunds/`, {
      method: "POST",
      headers: { ...authHeaders(keys), "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean; refund?: { id: string; status?: string }; message?: string };
    if (!res.ok || !json.success || !json.refund) throw new Error(`Instamojo refund failed: ${json.message ?? res.status}`);
    return { refundId: json.refund.id, status: json.refund.status ?? "PENDING" };
  },

  async testConnection(keys): Promise<TestResult> {
    try {
      const res = await fetch(`${BASE}/payment-requests/`, { headers: authHeaders(keys) });
      return res.status === 401 || res.status === 403
        ? { ok: false, message: "Instamojo rejected the credentials." }
        : { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
};
