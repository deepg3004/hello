// Gateway factory — resolve a seller's configured provider to its driver.

import type { GatewayType } from "@/lib/gateway-loader";
import type { PaymentGateway } from "@/lib/gateways/types";
import { razorpayGateway } from "@/lib/gateways/razorpay";
import { cashfreeGateway } from "@/lib/gateways/cashfree";
import { payuGateway } from "@/lib/gateways/payu";
import { instamojoGateway } from "@/lib/gateways/instamojo";
import { stripeGateway } from "@/lib/gateways/stripe";

const REGISTRY: Record<GatewayType, PaymentGateway> = {
  razorpay: razorpayGateway,
  cashfree: cashfreeGateway,
  payu: payuGateway,
  instamojo: instamojoGateway,
  stripe: stripeGateway,
};

/** Providers whose buyer-facing checkout is fully wired end-to-end (frontend +
 *  verified). Only these should be routed in LIVE checkout. Others are
 *  backend-implemented and connectable, pending frontend SDK + sandbox testing. */
export const LIVE_GATEWAYS: GatewayType[] = ["razorpay"];

export function getGateway(type: GatewayType): PaymentGateway {
  const g = REGISTRY[type];
  if (!g) throw new Error(`Unknown gateway: ${type}`);
  return g;
}

export function isLiveGateway(type: GatewayType): boolean {
  return LIVE_GATEWAYS.includes(type);
}

export type { PaymentGateway } from "@/lib/gateways/types";
