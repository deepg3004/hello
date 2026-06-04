// PayU (India) driver — hash-based redirect flow. key_id = merchant key,
// key_secret = salt. BACKEND-COMPLETE BUT UNVERIFIED; PayU uses a browser form
// POST + reverse-hash, which the checkout frontend does not yet implement.

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

const PAY_URL = process.env.PAYU_PAY_URL ?? "https://secure.payu.in/_payment";
const INFO_URL = process.env.PAYU_INFO_URL ?? "https://info.payu.in/merchant/postservice.php?form=2";

function sha512(s: string): string {
  return crypto.createHash("sha512").update(s).digest("hex");
}

export const payuGateway: PaymentGateway = {
  type: "payu",

  async createOrder(keys, input: CreateOrderInput): Promise<CreateOrderResult> {
    const key = keys.key_id;
    const salt = keys.key_secret;
    const txnid = input.receipt;
    const amount = (input.amountPaise / 100).toFixed(2);
    const productinfo = Object.values(input.notes ?? {}).join(" ").slice(0, 100) || "Order";
    const firstname = input.customer?.name || "Customer";
    const email = input.customer?.email || "buyer@example.com";
    // hash sequence: key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||salt
    const hash = sha512(
      `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`,
    );
    return {
      providerOrderId: txnid,
      client: {
        action: PAY_URL,
        method: "POST",
        fields: { key, txnid, amount, productinfo, firstname, email, phone: input.customer?.phone ?? "", hash },
      },
    };
  },

  // PayU returns a reverse hash on the callback:
  // sha512(salt|status||||||udf5..udf1|email|firstname|productinfo|amount|txnid|key)
  async verifyPayment(keys, input: VerifyPaymentInput): Promise<boolean> {
    const e = input.extra ?? {};
    const key = keys.key_id;
    const salt = keys.key_secret;
    const reverse = sha512(
      `${salt}|${e.status ?? ""}||||||||||${e.email ?? ""}|${e.firstname ?? ""}|${e.productinfo ?? ""}|${e.amount ?? ""}|${e.txnid ?? input.orderId}|${key}`,
    );
    const provided = (input.signature ?? e.hash ?? "").toLowerCase();
    return provided.length === reverse.length &&
      crypto.timingSafeEqual(Buffer.from(reverse), Buffer.from(provided)) &&
      (e.status ?? "") === "success";
  },

  // PayU S2S/webhook carries the same reverse hash; verify it synchronously.
  verifyWebhookSignature(rawBody, _headers, keys): boolean {
    try {
      const e = (rawBody.trim().startsWith("{")
        ? JSON.parse(rawBody)
        : Object.fromEntries(new URLSearchParams(rawBody))) as Record<string, string>;
      const reverse = sha512(
        `${keys.key_secret}|${e.status ?? ""}||||||||||${e.email ?? ""}|${e.firstname ?? ""}|${e.productinfo ?? ""}|${e.amount ?? ""}|${e.txnid ?? ""}|${keys.key_id}`,
      );
      const provided = (e.hash ?? "").toLowerCase();
      return (
        provided.length === reverse.length &&
        crypto.timingSafeEqual(Buffer.from(reverse), Buffer.from(provided))
      );
    } catch {
      return false;
    }
  },

  async refund(keys, input: RefundInput): Promise<RefundResult> {
    const command = "cancel_refund_transaction";
    const var1 = input.paymentId; // PayU mihpayid
    const var2 = `rf_${input.paymentId}`.slice(0, 30);
    const var3 = ((input.amountPaise ?? 0) / 100).toFixed(2);
    const hash = sha512(`${keys.key_id}|${command}|${var1}|${keys.key_secret}`);
    const body = new URLSearchParams({ key: keys.key_id, command, hash, var1, var2, var3 });
    const res = await fetch(INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { status?: number; request_id?: string; msg?: string };
    if (json.status !== 1) throw new Error(`PayU refund failed: ${json.msg ?? res.status}`);
    return { refundId: String(json.request_id ?? var2), status: "PENDING" };
  },

  async testConnection(keys): Promise<TestResult> {
    try {
      const command = "get_merchant_ibibo_codes";
      const hash = sha512(`${keys.key_id}|${command}|default|${keys.key_secret}`);
      const body = new URLSearchParams({ key: keys.key_id, command, hash, var1: "default" });
      const res = await fetch(INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = (await res.json().catch(() => ({}))) as { status?: number; msg?: string };
      return json.status === 1 ? { ok: true } : { ok: false, message: json.msg ?? "PayU rejected the credentials." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
};
