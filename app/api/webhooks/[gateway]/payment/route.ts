// POST /api/webhooks/[gateway]/payment
//
// S1B — generic, provider-agnostic webhook entry point. A seller configures this
// URL (with their provider segment, e.g. /api/webhooks/cashfree/payment) in
// their gateway dashboard. We resolve the matching driver via getGateway().
//
// Razorpay keeps its dedicated, fully-wired route — this generic route 308-
// redirects razorpay traffic there so the existing seller-webhook fulfillment is
// preserved.
//
// Cashfree (once live) is fulfilled HERE: it's the reliable backstop for when a
// buyer's browser drops between paying and the in-app verify call. Lean
// finalization mirrors app/api/webhooks/razorpay/seller: verify signature →
// confirm status → mark paid → ledger → recovery → wallet fee → stock → notify.
//
// Providers still not live just get a 200 ack (so the gateway stops retrying).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { GatewayType } from "@/lib/gateway-loader";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";
import { notifyPaymentReceived } from "@/lib/notifications/events";
import {
  chargePlatformWalletFee,
  decrementStockForOrder,
  deliverOrderProducts,
} from "@/lib/order-fulfillment";
import {
  findPendingBookingOrEvent,
  finalizePaidBooking,
  finalizePaidEventRegistration,
} from "@/lib/event-booking-fulfillment";
import { fireMarketingWebhook } from "@/lib/marketing";

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

  try {
    getGateway(gateway);
  } catch {
    return NextResponse.json({ error: "Unsupported gateway" }, { status: 404 });
  }

  // Only live providers fulfil; others just ack so the gateway stops retrying.
  if (!isLiveGateway(gateway)) {
    console.info(`[webhooks/${gateway}] received but gateway not live — ack only.`);
    return NextResponse.json({ ok: true, gateway, live: false, fulfilled: false });
  }

  if (gateway === "cashfree") {
    return handleCashfree(request);
  }

  return NextResponse.json({ ok: true, gateway, fulfilled: false });
}

// ── Cashfree ───────────────────────────────────────────────────────────────
// Webhook body (2023-08-01): { type, data: { order: { order_id, order_amount },
// payment: { cf_payment_id, payment_status } } }. We match our order by
// gateway_order_id (= the order_id we sent Cashfree), verify the HMAC with the
// seller's secret, then re-confirm status via the API before any write.
async function handleCashfree(request: Request): Promise<Response> {
  const raw = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k] = v;
  });

  let body: {
    type?: string;
    data?: {
      order?: { order_id?: string };
      payment?: { cf_payment_id?: string | number; payment_status?: string };
    };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const cfOrderId = body.data?.order?.order_id;
  const paymentStatus = body.data?.payment?.payment_status;
  if (!cfOrderId) {
    return NextResponse.json({ ok: true, ignored: "no_order_id" });
  }
  // Only act on successful payments; ack the rest.
  if (paymentStatus && paymentStatus !== "SUCCESS") {
    return NextResponse.json({ ok: true, ignored: `status_${paymentStatus}` });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, status, seller_user_id, page_id, product_id, amount, seller_amount, platform_commission, currency, buyer_email, buyer_name, source, gateway_owner, gateway_order_id",
    )
    .eq("gateway_order_id", cfOrderId)
    .eq("gateway_owner", "seller")
    .maybeSingle();
  if (!order) {
    // Fallback: a paid booking / event registration whose buyer tab dropped
    // before in-app verify (they hold a pending row keyed by gateway_order_id
    // and don't create the orders row until confirmed).
    const pending = await findPendingBookingOrEvent(cfOrderId, admin);
    if (pending) {
      const pkeys = await loadSellerGatewayKeys(pending.sellerUserId);
      if (!pkeys) {
        return NextResponse.json({ error: "No seller gateway" }, { status: 400 });
      }
      if (!getGateway("cashfree").verifyWebhookSignature(raw, headers, pkeys)) {
        return NextResponse.json({ error: "Bad signature" }, { status: 401 });
      }
      const confirmedAtGw = await getGateway("cashfree").verifyPayment(pkeys, {
        orderId: cfOrderId,
      });
      if (!confirmedAtGw) {
        return NextResponse.json({ ok: true, ignored: "not_paid_at_gateway" });
      }
      const cfPaymentId = String(body.data?.payment?.cf_payment_id ?? cfOrderId);
      const opts = { provider: "cashfree" as const, paymentRef: cfPaymentId, signatureRef: null };
      const r =
        pending.kind === "booking"
          ? await finalizePaidBooking(pending.id, opts, admin)
          : await finalizePaidEventRegistration(pending.id, opts, admin);
      return NextResponse.json({ ok: true, [pending.kind]: true, already: r.already });
    }
    return NextResponse.json({ ok: true, ignored: "unknown_order" });
  }

  const keys = await loadSellerGatewayKeys(order.seller_user_id);
  if (!keys) {
    return NextResponse.json({ error: "No seller gateway" }, { status: 400 });
  }
  // Verify the webhook signature against the seller's secret.
  if (!getGateway("cashfree").verifyWebhookSignature(raw, headers, keys)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  // Defence in depth: re-confirm the order really is PAID at Cashfree before we
  // credit anything (don't trust the payload's status alone).
  const confirmed = await getGateway("cashfree").verifyPayment(keys, {
    orderId: cfOrderId,
  });
  if (!confirmed) {
    return NextResponse.json({ ok: true, ignored: "not_paid_at_gateway" });
  }

  const cfPaymentId = String(body.data?.payment?.cf_payment_id ?? cfOrderId);

  // Idempotency (same table as razorpay; distinct provider namespace).
  const { error: dupErr } = await admin.from("webhook_events_processed").insert({
    provider: "cashfree_seller",
    event_id: `cashfree_${order.id}_${cfPaymentId}`,
    event_type: body.type ?? "PAYMENT_SUCCESS_WEBHOOK",
    resource_id: cfPaymentId,
  });
  if (dupErr) {
    return NextResponse.json({ ok: true, dedup: true });
  }

  const paidAt = new Date().toISOString();
  const { data: updatedRows } = await admin
    .from("orders")
    .update({ status: "paid", gateway_payment_id: cfPaymentId, paid_at: paidAt })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: true, already_handled: true });
  }
  // Bump child rows on the same order.
  await admin
    .from("orders")
    .update({ status: "paid", gateway_payment_id: cfPaymentId, paid_at: paidAt })
    .eq("parent_order_id", order.id)
    .eq("source", "bump")
    .eq("status", "pending");

  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id: order.id,
      type: "sale",
      amount: Number(order.seller_amount),
      status: "completed",
      reference_id: cfPaymentId,
      notes: `Sale ${cfOrderId} (cashfree webhook)`,
    },
    {
      user_id: order.seller_user_id,
      order_id: order.id,
      type: "commission",
      amount: -Number(order.platform_commission),
      status: "completed",
      reference_id: cfPaymentId,
      notes: `Commission ${cfOrderId} (cashfree webhook)`,
    },
  ]);

  await admin
    .from("abandoned_checkouts")
    .update({ status: "recovered", recovered_at: paidAt })
    .eq("buyer_email", order.buyer_email)
    .eq("page_id", order.page_id)
    .eq("status", "active");

  await chargePlatformWalletFee(
    { sellerUserId: order.seller_user_id, orderId: order.id },
    admin,
  );

  if (order.source === "cart") {
    const { fulfillCartOrder } = await import("@/lib/cart-fulfillment");
    await fulfillCartOrder(
      {
        id: order.id,
        buyer_email: order.buyer_email,
        buyer_name: (order as { buyer_name?: string | null }).buyer_name ?? null,
        seller_user_id: order.seller_user_id,
      },
      admin,
    );
  } else {
    await decrementStockForOrder(order.id, admin);
    // Deliver the product when the buyer's tab dropped and this webhook is the
    // only confirmation (mirrors verify-payment / the razorpay seller webhook).
    await deliverOrderProducts(
      {
        id: order.id,
        page_id: order.page_id,
        product_id: (order as { product_id?: string | null }).product_id ?? null,
        seller_user_id: order.seller_user_id,
        buyer_email: order.buyer_email,
        buyer_name: order.buyer_name,
        amount: Number(order.amount),
        currency: (order as { currency?: string | null }).currency ?? null,
      },
      admin,
    );
  }

  await fireMarketingWebhook(order.seller_user_id, "order_paid", {
    order_id: order.id,
    amount: Number(order.amount ?? 0),
    buyer_email: order.buyer_email,
    page_id: order.page_id,
  });

  await notifyPaymentReceived(
    {
      sellerId: order.seller_user_id,
      amountRupees: Number(order.amount),
      buyer: order.buyer_email,
      pageId: order.page_id,
      orderId: order.id,
    },
    admin,
  );

  return NextResponse.json({ ok: true, fulfilled: true });
}
