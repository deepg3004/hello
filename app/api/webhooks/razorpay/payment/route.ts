// POST /api/webhooks/razorpay/payment
//
// Backup webhook in case the buyer's browser drops between Razorpay capture
// and our /api/checkout/verify-payment call. Razorpay also calls this on
// failures and Route transfer settlements.
//
// Configure in Razorpay dashboard → Settings → Webhooks:
//   URL: https://app.invoxai.io/api/webhooks/razorpay/payment
//   Events: payment.captured, payment.failed, transfer.settled

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";

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

interface WebhookPayload {
  event: string;
  payload: {
    payment?: { entity: PaymentEntity };
    transfer?: { entity: TransferEntity };
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
      if (!order || order.status === "paid") break;

      const paidAt = new Date().toISOString();
      await admin
        .from("orders")
        .update({
          status: "paid",
          gateway_payment_id: payment.id,
          paid_at: paidAt,
        })
        .eq("id", order.id);

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
      break;
    }

    case "payment.failed": {
      if (!payment?.order_id) break;
      await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("gateway_order_id", payment.order_id);
      // TODO: send failure email to buyer + WhatsApp alert to seller
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
