// POST /api/webhooks/razorpay/seller
//
// Fallback confirmation for SELLER-gateway orders (Phase 4, multi-gateway).
// When an order is created on a seller's OWN Razorpay account, the in-checkout
// /api/checkout/verify-payment call is the primary confirmation — but if the
// buyer's browser drops between capture and that call, the order is left
// pending. The seller configures THIS url in their Razorpay dashboard so the
// payment.captured webhook (signed with the seller's own webhook secret)
// confirms the order.
//
// Single url for all sellers: we find the order from the (unverified) payload,
// load that seller's webhook secret, then verify the HMAC — verification gates
// every write, so the lookup-before-verify is safe.
//
// Lean finalization (mirrors app/api/webhooks/razorpay/payment): mark paid →
// ledger → abandoned-recovery → platform wallet fee → notify. The full
// post-purchase pipeline (invoice, Telegram, affiliate, OTO) runs only on the
// in-checkout path — same as the platform webhook today.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignatureWithSecret } from "@/lib/razorpay";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
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

interface PaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  notes?: Record<string, string>;
}

interface WebhookPayload {
  id?: string;
  event: string;
  payload: { payment?: { entity: PaymentEntity } };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  let body: WebhookPayload;
  try {
    body = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const event = body.event;
  const payment = body.payload?.payment?.entity;

  // We only confirm captures here; ack everything else so Razorpay stops
  // retrying. (Failures/refunds for seller gateways are future work.)
  if (event !== "payment.captured" || !payment?.order_id) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const admin = createAdminClient();

  // Find OUR order from the (still unverified) Razorpay order id. Scoped to
  // seller-gateway orders — platform orders go through the platform webhook.
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, status, seller_user_id, page_id, product_id, amount, seller_amount, platform_commission, currency, buyer_email, buyer_name, source, gateway_owner",
    )
    .eq("gateway_order_id", payment.order_id)
    .eq("gateway_owner", "seller")
    .maybeSingle();
  if (!order) {
    // Fallback: a paid 1:1 booking / event registration whose buyer tab dropped
    // before the in-app verify call. These hold a pending row keyed by
    // gateway_order_id but don't create the orders row until confirmed.
    const pending = await findPendingBookingOrEvent(payment.order_id, admin);
    if (pending) {
      const keys = await loadSellerGatewayKeys(pending.sellerUserId);
      if (!keys?.webhook_secret) {
        return NextResponse.json({ error: "No webhook secret configured" }, { status: 400 });
      }
      if (!verifyWebhookSignatureWithSecret(raw, signature, keys.webhook_secret)) {
        return NextResponse.json({ error: "Bad signature" }, { status: 401 });
      }
      const opts = { provider: "razorpay" as const, paymentRef: payment.id, signatureRef: null };
      const r =
        pending.kind === "booking"
          ? await finalizePaidBooking(pending.id, opts, admin)
          : await finalizePaidEventRegistration(pending.id, opts, admin);
      return NextResponse.json({ ok: true, [pending.kind]: true, already: r.already });
    }
    // Not a seller-gateway order/booking/event we know about — ack and ignore.
    return NextResponse.json({ ok: true, ignored: "unknown_order" });
  }

  // Verify the signature with THIS seller's own webhook secret.
  const keys = await loadSellerGatewayKeys(order.seller_user_id);
  if (!keys?.webhook_secret) {
    // Seller hasn't configured a webhook secret — we can't trust this payload.
    return NextResponse.json(
      { error: "No webhook secret configured" },
      { status: 400 },
    );
  }
  if (!verifyWebhookSignatureWithSecret(raw, signature, keys.webhook_secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  // ── Idempotency gate (same table as the platform webhook, distinct namespace).
  const eventId =
    body.id ?? `seller_${order.id}_${payment.id}_${event}`;
  const { error: dupErr } = await admin
    .from("webhook_events_processed")
    .insert({
      provider: "razorpay_seller",
      event_id: eventId,
      event_type: event,
      resource_id: payment.id,
    });
  if (dupErr) {
    return NextResponse.json({ ok: true, dedup: true });
  }

  // Guarded transition: only flip pending → paid. If verify-payment already
  // ran (or another delivery won), zero rows update and we skip ledger writes.
  const paidAt = new Date().toISOString();
  const { data: updatedRows } = await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: payment.id,
      paid_at: paidAt,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: true, already_handled: true });
  }

  // Ledger: sale (seller credit) + commission (0 for seller-gateway orders).
  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id: order.id,
      type: "sale",
      amount: Number(order.seller_amount),
      status: "completed",
      reference_id: payment.id,
      notes: `Sale ${payment.order_id} (seller webhook)`,
    },
    {
      user_id: order.seller_user_id,
      order_id: order.id,
      type: "commission",
      amount: -Number(order.platform_commission),
      status: "completed",
      reference_id: payment.id,
      notes: `Commission ${payment.order_id} (seller webhook)`,
    },
  ]);

  await admin
    .from("abandoned_checkouts")
    .update({ status: "recovered", recovered_at: paidAt })
    .eq("buyer_email", order.buyer_email)
    .eq("page_id", order.page_id)
    .eq("status", "active");

  // Platform revenue for seller-gateway orders = the wallet fee.
  await chargePlatformWalletFee(
    { sellerUserId: order.seller_user_id, orderId: order.id },
    admin,
  );
  // Cart orders: per-line stock + itemized receipt (the single-item
  // decrementStockForOrder reads orders.product_id, which is NULL for carts).
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
    // Deliver the product (receipt/invoice/Telegram/Discord/course/downloads) —
    // the in-checkout verify-payment is the primary path, but if the buyer's tab
    // dropped this webhook is the only confirmation, so it must deliver too.
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

  return NextResponse.json({ ok: true });
}
