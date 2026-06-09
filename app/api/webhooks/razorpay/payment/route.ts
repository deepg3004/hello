// POST /api/webhooks/razorpay/payment
//
// Backup webhook in case the buyer's browser drops between Razorpay capture
// and our /api/checkout/verify-payment call. Razorpay also calls this on
// failures, Route transfer settlements, and refunds.
//
// Configure in Razorpay dashboard → Settings → Webhooks:
//   URL: https://app.invoxai.io/api/webhooks/razorpay/payment
//   Events: payment.captured, payment.failed, transfer.processed,
//           transfer.settled, refund.created, refund.processed
//
// Idempotency: every event_id is recorded in webhook_events_processed BEFORE
// any side-effect work. A duplicate delivery hits the PK conflict and exits
// cleanly without writing a second ledger row (closes audit #1 — double-credit
// race that previously relied on the racy `status==='paid'` short-circuit).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { notifyPaymentReceived } from "@/lib/notifications/events";

interface PaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  currency?: string;
  status?: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string>;
}

interface TransferEntity {
  id: string;
  source: string;       // payment id
  recipient: string;    // linked account id
  amount: number;
  currency?: string;
  status?: string;
  notes?: Record<string, string>;
}

interface RefundEntity {
  id: string;
  payment_id: string;
  amount: number;       // paise
  currency?: string;
  status?: string;
  notes?: Record<string, string>;
}

interface WebhookPayload {
  /** Razorpay's per-delivery event id, e.g. evt_KSyJOZ5KK9pZ8u. Used for
   *  dedup against the webhook_events_processed table. */
  id?: string;
  event: string;
  payload: {
    payment?: { entity: PaymentEntity };
    transfer?: { entity: TransferEntity };
    refund?: { entity: RefundEntity };
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const event = body.event;
  const payment = body.payload?.payment?.entity;
  const transfer = body.payload?.transfer?.entity;
  const refund = body.payload?.refund?.entity;

  // ── Idempotency gate ─────────────────────────────────────────────────────
  // Try to insert the event id; PK conflict on (provider, event_id) means
  // we've already processed this delivery. Razorpay generally sends every
  // event with an `id` — when missing (very old API contract), fall back to
  // a deterministic synthetic key so we still dedupe per-payment.
  const eventId =
    body.id ??
    (payment ? `pay_${payment.id}_${event}` : null) ??
    (transfer ? `xfr_${transfer.id}_${event}` : null) ??
    (refund ? `ref_${refund.id}_${event}` : null);
  if (eventId) {
    const { error: dupErr } = await admin
      .from("webhook_events_processed")
      .insert({
        provider: "razorpay",
        event_id: eventId,
        event_type: event,
        resource_id:
          payment?.id ?? transfer?.id ?? refund?.id ?? payment?.order_id ?? null,
      });
    if (dupErr) {
      // PK conflict → already processed. Acknowledge so Razorpay stops
      // retrying without re-running side effects.
      return NextResponse.json({ ok: true, dedup: true });
    }
  }

  switch (event) {
    case "payment.captured": {
      if (!payment?.order_id) break;
      // Locate our order via the Razorpay order id we recorded on create.
      const { data: order } = await admin
        .from("orders")
        .select(
          "id, status, seller_user_id, page_id, amount, seller_amount, platform_commission, buyer_email, coupon_id",
        )
        .eq("gateway_order_id", payment.order_id)
        .single();
      if (!order) break;

      const paidAt = new Date().toISOString();
      // Guarded transition: only flip pending → paid. With the event-id
      // dedup above this is belt-and-braces; it also handles the case where
      // verify-payment ran first (already paid → no-op below).
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
        // Order wasn't in 'pending' — either already paid (verify-payment
        // beat us) or in a terminal state. Either way, no ledger writes.
        break;
      }

      await admin.from("transactions").insert([
        {
          user_id: order.seller_user_id,
          order_id: order.id,
          type: "sale",
          amount: Number(order.seller_amount),
          status: "completed",
          reference_id: payment.id,
          notes: `Sale ${payment.order_id} (webhook)`,
        },
        {
          user_id: order.seller_user_id,
          order_id: order.id,
          type: "commission",
          amount: -Number(order.platform_commission),
          status: "completed",
          reference_id: payment.id,
          notes: `Commission ${payment.order_id} (webhook)`,
        },
      ]);

      await admin
        .from("abandoned_checkouts")
        .update({ status: "recovered", recovered_at: paidAt })
        .eq("buyer_email", order.buyer_email)
        .eq("page_id", order.page_id)
        .eq("status", "active");

      // In-app bell — seller + admins. Best-effort; never blocks the webhook.
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

      // Order-bump sync: a bump child rides on the SAME payment. If the buyer
      // closed their tab before verify-payment ran, the bump would be left
      // pending. Finalize any pending bump child here (mirrors verify-payment)
      // and enqueue its own invoice. Guarded by status='pending' so it's
      // idempotent across the webhook + verify-payment race.
      const { data: bumpRows } = await admin
        .from("orders")
        .update({ status: "paid", gateway_payment_id: payment.id, paid_at: paidAt })
        .eq("parent_order_id", order.id)
        .eq("source", "bump")
        .eq("status", "pending")
        .select("id");
      if (bumpRows && bumpRows.length > 0) {
        try {
          const { enqueueInvoiceJob } = await import("@/lib/queues/invoices");
          for (const b of bumpRows) void enqueueInvoiceJob(b.id);
        } catch (e) {
          console.error("[razorpay/payment] bump invoice enqueue failed", e);
        }
      }
      break;
    }

    case "payment.failed": {
      if (!payment?.order_id) break;
      // Look up the order before flipping status so we can notify the seller.
      const { data: failed } = await admin
        .from("orders")
        .select(
          "id, status, seller_user_id, page_id, buyer_email, buyer_name, amount",
        )
        .eq("gateway_order_id", payment.order_id)
        .single();
      // Status guard: only transition pending → failed. Razorpay can resend
      // a stale payment.failed after we've already marked it paid (via
      // verify-payment); without this guard we'd corrupt the ledger by
      // flipping a paid order back to failed.
      await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("gateway_order_id", payment.order_id)
        .eq("status", "pending");
      if (failed && failed.status === "pending") {
        try {
          const { notifyPaymentFailed } = await import(
            "@/lib/notification-triggers"
          );
          const reason =
            (payment as unknown as { error_description?: string })
              .error_description ??
            (payment as unknown as { error_reason?: string }).error_reason ??
            "Payment declined";
          void notifyPaymentFailed({
            seller_user_id: failed.seller_user_id,
            buyer_name: failed.buyer_name,
            buyer_email: failed.buyer_email,
            page_id: failed.page_id,
            amount: failed.amount,
            reason,
          });
        } catch (e) {
          console.error("[razorpay-webhook] notifyPaymentFailed failed", e);
        }
      }
      break;
    }

    case "refund.created":
    case "refund.processed": {
      // Razorpay refund webhook. Pairs with refundOrderAction in
      // actions/transactions.ts which calls the refund API; this handler
      // exists so a refund initiated DIRECTLY in the Razorpay dashboard
      // (bypassing our admin UI) still reverses our ledger correctly.
      if (!refund?.payment_id) break;
      const { data: order } = await admin
        .from("orders")
        .select(
          "id, status, seller_user_id, seller_amount, platform_commission, amount",
        )
        .eq("gateway_payment_id", refund.payment_id)
        .maybeSingle();
      if (!order) break;
      // Don't double-reverse — if our admin path already wrote the
      // negating rows we'll see status='refunded'.
      if (order.status === "refunded") break;
      await admin
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", order.id);
      await admin.from("transactions").insert([
        {
          user_id: order.seller_user_id,
          order_id: order.id,
          type: "refund",
          amount: -Number(order.seller_amount),
          status: "completed",
          reference_id: refund.id,
          notes: `Refund ${refund.id} (webhook) — sale reversal`,
        },
        {
          user_id: order.seller_user_id,
          order_id: order.id,
          type: "refund_commission",
          amount: Number(order.platform_commission),
          status: "completed",
          reference_id: refund.id,
          notes: `Refund ${refund.id} (webhook) — commission give-back`,
        },
      ]);
      // Reverse affiliate commission if any.
      await admin
        .from("affiliate_payouts")
        .update({ status: "reversed", reversed_at: new Date().toISOString() })
        .eq("order_id", order.id)
        .in("status", ["pending", "paid"]);
      break;
    }

    case "transfer.processed":
    case "transfer.settled": {
      if (!transfer) break;
      // Persist the settlement on any matching payout record we have. For
      // Route splits we don't always have a payouts row, so we just log.
      await admin.from("transactions").insert({
        user_id:
          (transfer.notes?.invoxai_seller_id as string | undefined) ?? null,
        type: "payout",
        amount: transfer.amount / 100,
        status: "completed",
        reference_id: transfer.id,
        notes: `Route transfer settled to ${transfer.recipient}`,
      });
      break;
    }

    default: {
      // Acknowledge unknown events so Razorpay doesn't retry forever.
      return NextResponse.json({ ok: true, ignored: event });
    }
  }

  return NextResponse.json({ ok: true });
}
