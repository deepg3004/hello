// =============================================================================
// Server helper shared by every seller-gateway create route (product page,
// store/cart, OTO, bookings, events). Resolves the seller's configured gateway,
// creates the provider order via its driver, and shapes the fields the buyer
// client needs. Keeps all flows gateway-agnostic from one place.
// =============================================================================

import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";
import type { CreateOrderInput } from "@/lib/gateways/types";

export type SellerOrderResult =
  | {
      ok: true;
      gateway: string;
      providerOrderId: string;
      client: Record<string, unknown>;
    }
  | { ok: false; status: number; error: string };

/** Create an order on the seller's OWN gateway (no-funds model). */
export async function createSellerGatewayOrder(
  sellerId: string,
  input: CreateOrderInput,
): Promise<SellerOrderResult> {
  const keys = await loadSellerGatewayKeys(sellerId);
  if (!keys || !isLiveGateway(keys.gateway_type)) {
    return {
      ok: false,
      status: 402,
      error: "This store can't accept payments yet.",
    };
  }
  try {
    const result = await getGateway(keys.gateway_type).createOrder(keys, input);
    return {
      ok: true,
      gateway: keys.gateway_type,
      providerOrderId: result.providerOrderId,
      client: result.client,
    };
  } catch (e) {
    console.error("[checkout-gateway] createOrder failed", e);
    // Distinguish a credentials-rejected failure (the seller saved invalid /
    // wrong-environment keys — e.g. Cashfree sandbox keys against the prod base)
    // from a transient outage, so the buyer sees an actionable message and the
    // seller can tell their keys are wrong from the logs.
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    const credsRejected =
      msg.includes("authentication") ||
      msg.includes("unauthor") ||
      msg.includes("401") ||
      msg.includes("invalid") && msg.includes("key");
    if (credsRejected) {
      return {
        ok: false,
        status: 502,
        error:
          "This store's payment gateway rejected its credentials. The seller needs to re-check their gateway keys.",
      };
    }
    return {
      ok: false,
      status: 502,
      error: "Payment gateway is temporarily unavailable. Please try again.",
    };
  }
}

/** The provider-specific fields the buyer client needs, by gateway. */
export function gatewayClientFields(
  gateway: string,
  providerOrderId: string,
  client: Record<string, unknown>,
): {
  gateway: string;
  razorpay_order_id?: string;
  key?: string;
  cashfree?: Record<string, unknown>;
} {
  return {
    gateway,
    razorpay_order_id: gateway === "razorpay" ? providerOrderId : undefined,
    key: gateway === "razorpay" ? (client.key as string) : undefined,
    cashfree: gateway === "cashfree" ? client : undefined,
  };
}
