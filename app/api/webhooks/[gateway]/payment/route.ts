// POST /api/webhooks/[gateway]/payment
//
// S1B — generic, provider-agnostic webhook entry point. A seller configures this
// URL (with their provider segment, e.g. /api/webhooks/cashfree/payment) in
// their gateway dashboard. We resolve the matching driver via getGateway().
//
// Razorpay keeps its dedicated, fully-wired route — this generic route 308-
// redirects razorpay traffic there so the existing seller-webhook fulfillment is
// preserved (per the S1B spec).
//
// For the other providers: the buyer-facing checkout is not LIVE yet
// (LIVE_GATEWAYS = ['razorpay']), so there are no real orders to confirm. This
// route validates the provider and acknowledges (200) so the gateway stops
// retrying, and logs the delivery for observability. Per-provider signature
// verification + order fulfillment activate when that provider is promoted to
// LIVE_GATEWAYS — at which point it needs the seller resolved from the payload
// (a driver-level parseWebhookEvent), mirroring app/api/webhooks/razorpay/seller.

import { NextResponse } from "next/server";

import type { GatewayType } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KNOWN: GatewayType[] = ["razorpay", "cashfree", "payu", "instamojo", "stripe"];

export async function POST(
  request: Request,
  { params }: { params: { gateway: string } },
) {
  const gateway = params.gateway?.toLowerCase() as GatewayType;

  if (!KNOWN.includes(gateway)) {
    return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
  }

  // Razorpay → preserve the dedicated, fully-wired seller webhook.
  if (gateway === "razorpay") {
    const url = new URL("/api/webhooks/razorpay/seller", request.url);
    return NextResponse.redirect(url, 308);
  }

  // Resolve the driver so an unconfigured provider 404s rather than silently
  // accepting (the driver also fronts the signature-verify used once live).
  try {
    getGateway(gateway);
  } catch {
    return NextResponse.json({ error: "Unsupported gateway" }, { status: 404 });
  }

  // Non-razorpay checkout is not live yet → nothing to fulfill. Ack so the
  // provider stops retrying; log for observability.
  const live = isLiveGateway(gateway);
  console.info(
    `[webhooks/${gateway}] received (live=${live}). No fulfillment — ${gateway} checkout is not in LIVE_GATEWAYS yet.`,
  );
  return NextResponse.json({ ok: true, gateway, live, fulfilled: false });
}
