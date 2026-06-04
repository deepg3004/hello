// Razorpay driver — wraps the existing, battle-tested lib/razorpay helpers so
// the live checkout behaviour is unchanged.

import Razorpay from "razorpay";

import {
  createOrderOnKeys,
  verifyPaymentWithSecret,
  verifyWebhookSignatureWithSecret,
} from "@/lib/razorpay";
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

function client(keys: GatewayKeys): Razorpay {
  return new Razorpay({ key_id: keys.key_id, key_secret: keys.key_secret });
}

export const razorpayGateway: PaymentGateway = {
  type: "razorpay",

  async createOrder(keys: GatewayKeys, input: CreateOrderInput): Promise<CreateOrderResult> {
    const order = (await createOrderOnKeys(
      { key_id: keys.key_id, key_secret: keys.key_secret },
      {
        amount: input.amountPaise,
        currency: input.currency ?? "INR",
        receipt: input.receipt,
        notes: input.notes,
      },
    )) as unknown as { id: string; amount: number | string };
    return {
      providerOrderId: order.id,
      client: { key: keys.key_id, orderId: order.id, amount: order.amount },
      raw: order,
    };
  },

  async verifyPayment(keys: GatewayKeys, input: VerifyPaymentInput): Promise<boolean> {
    if (!input.paymentId || !input.signature) return false;
    return verifyPaymentWithSecret(
      {
        razorpay_order_id: input.orderId,
        razorpay_payment_id: input.paymentId,
        razorpay_signature: input.signature,
      },
      keys.key_secret,
    );
  },

  verifyWebhookSignature(rawBody, headers, keys): boolean {
    return verifyWebhookSignatureWithSecret(
      rawBody,
      header(headers, "x-razorpay-signature"),
      keys.webhook_secret,
    );
  },

  async refund(keys: GatewayKeys, input: RefundInput): Promise<RefundResult> {
    const r = (await client(keys).payments.refund(input.paymentId, {
      ...(input.amountPaise ? { amount: input.amountPaise } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    } as unknown as Parameters<Razorpay["payments"]["refund"]>[1])) as unknown as {
      id: string;
      status: string;
    };
    return { refundId: r.id, status: r.status };
  },

  async getPaymentStatus(keys: GatewayKeys, paymentId: string): Promise<string> {
    const p = (await client(keys).payments.fetch(paymentId)) as unknown as { status: string };
    return p.status;
  },

  async testConnection(keys: GatewayKeys): Promise<TestResult> {
    try {
      await client(keys).payments.all({ count: 1 });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Invalid Razorpay keys" };
    }
  },
};
