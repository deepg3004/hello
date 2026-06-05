// =============================================================================
// Provider-agnostic payment gateway adapter (Session 1B).
//
// Each seller connects their OWN gateway (keys encrypted in
// seller_gateway_config). At checkout/refund/webhook we resolve the seller's
// configured provider via getGateway(type) and call this interface — instead of
// importing Razorpay directly. Server-only.
//
// NOTE: createOrder returns `client`, a provider-specific payload the browser
// needs to actually collect payment (Razorpay: key+orderId; Cashfree:
// payment_session_id; Stripe: client_secret; PayU: form fields; Instamojo:
// redirect URL). The checkout frontend is currently wired for Razorpay only;
// other providers' front-end SDK handling is follow-up work.
// =============================================================================

import type { GatewayKeys, GatewayType } from "@/lib/gateway-loader";

export interface CreateOrderInput {
  amountPaise: number;
  currency?: string;
  /** Our internal order id (echoed back where the provider supports it). */
  receipt: string;
  notes?: Record<string, string>;
  /** Buyer details — some providers (Cashfree, Stripe) require them up-front. */
  customer?: { name?: string; email?: string; phone?: string };
}

export interface CreateOrderResult {
  /** Provider's order/intent id. */
  providerOrderId: string;
  /** What the browser needs to open this provider's checkout. */
  client: Record<string, unknown>;
  raw?: unknown;
}

export interface VerifyPaymentInput {
  /** Provider order id. */
  orderId: string;
  /** Provider payment id (where applicable). */
  paymentId?: string;
  /** Signature/token returned by the provider's checkout. */
  signature?: string;
  /** Any extra provider params (PayU posts a bag of fields). */
  extra?: Record<string, string>;
}

export interface RefundInput {
  paymentId: string;
  amountPaise?: number; // omit = full refund
  notes?: Record<string, string>;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export interface TestResult {
  ok: boolean;
  message?: string;
}

export interface PaymentGateway {
  readonly type: GatewayType;
  createOrder(keys: GatewayKeys, input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(keys: GatewayKeys, input: VerifyPaymentInput): Promise<boolean>;
  /** Verify a webhook against the seller's webhook secret. headers as a plain map. */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    keys: GatewayKeys,
  ): boolean;
  refund(keys: GatewayKeys, input: RefundInput): Promise<RefundResult>;
  getPaymentStatus?(keys: GatewayKeys, paymentId: string): Promise<string>;
  /** Live credential check used by the "Test connection" connect action. */
  testConnection(keys: GatewayKeys): Promise<TestResult>;
}

/** Lower-cased header lookup helper for drivers. */
export function header(headers: Record<string, string>, name: string): string | null {
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k]!;
  }
  return null;
}
