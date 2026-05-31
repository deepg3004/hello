// POST /api/webhooks/razorpay/subscription
//
// Razorpay subscription lifecycle webhook.
//
// 1. Verify X-Razorpay-Signature against RAZORPAY_WEBHOOK_SECRET (HMAC-SHA256).
// 2. Dedup against webhook_events_processed.
// 3. On subscription.activated → mark user as active on the chosen plan.
// 4. On subscription.charged   → insert a transaction row.
// 5. On refund.created (with subscription id in notes) → insert negative
//    subscription_payment so the ledger stays balanced after a refund.
// 6. On subscription.halted / .deactivated / .cancelled / .paused → update.
//
// Configure the webhook URL in Razorpay dashboard:
//   https://app.invoxai.io/api/webhooks/razorpay/subscription

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { PLANS, type PlanKey } from "@/lib/plans";

interface SubscriptionEntity {
  id: string;
  status?: string;
  plan_id?: string;
  current_end?: number;
  current_start?: number;
  notes?: Record<string, string>;
  customer_id?: string;
}

interface PaymentEntity {
  id: string;
  amount: number;
  currency?: string;
  status?: string;
}

interface RefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  currency?: string;
  status?: string;
  notes?: Record<string, string>;
}

interface WebhookPayload {
  id?: string;
  event: string;
  payload: {
    subscription?: { entity: SubscriptionEntity };
    payment?: { entity: PaymentEntity };
    refund?: { entity: RefundEntity };
  };
}

function isPlanKey(s: string | undefined): s is PlanKey {
  return !!s && s in PLANS;
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
  const subEntity = body.payload?.subscription?.entity;
  const payEntity = body.payload?.payment?.entity;
  const refundEntity = body.payload?.refund?.entity;

  // ── Idempotency gate (see app/api/webhooks/razorpay/payment for rationale)
  const eventId =
    body.id ??
    (subEntity ? `sub_${subEntity.id}_${event}` : null) ??
    (refundEntity ? `ref_${refundEntity.id}_${event}` : null);
  if (eventId) {
    const { error: dupErr } = await admin
      .from("webhook_events_processed")
      .insert({
        provider: "razorpay",
        event_id: eventId,
        event_type: event,
        resource_id: subEntity?.id ?? refundEntity?.id ?? null,
      });
    if (dupErr) {
      return NextResponse.json({ ok: true, dedup: true });
    }
  }

  // ── Refund of a subscription charge — reverse the ledger entry ──────────
  // Razorpay sends refund.* events on the main "payments" event stream and
  // the subscription event stream depending on configuration; we accept it
  // here too because Razorpay won't tell us up-front which charge belongs
  // to a subscription. The reference_id ties it back to the original
  // subscription_payment row.
  if (event === "refund.created" || event === "refund.processed") {
    if (!refundEntity?.payment_id) {
      return NextResponse.json({ ok: true, skipped: "no payment_id" });
    }
    const { data: original } = await admin
      .from("transactions")
      .select("id, user_id, amount, type")
      .eq("reference_id", refundEntity.payment_id)
      .eq("type", "subscription_payment")
      .maybeSingle();
    if (!original) {
      // Not a subscription refund — let the main payment webhook handle it.
      return NextResponse.json({ ok: true, skipped: "not a subscription charge" });
    }
    await admin.from("transactions").insert({
      user_id: original.user_id,
      type: "subscription_refund",
      amount: -Number(original.amount),
      status: "completed",
      reference_id: refundEntity.id,
      notes: `Subscription refund for ${refundEntity.payment_id}`,
    });
    return NextResponse.json({ ok: true, refunded: refundEntity.id });
  }

  // We need a subscription to do anything meaningful past this point.
  if (!subEntity?.id) {
    return NextResponse.json({ ok: true, skipped: "no subscription entity" });
  }

  // Pull our stored row to find user_id + plan.
  const { data: sub } = await admin
    .from("user_subscriptions")
    .select("id, user_id, plan")
    .eq("razorpay_subscription_id", subEntity.id)
    .single();

  // Fallback: read user_id from notes if we never recorded it.
  const noteUser = subEntity.notes?.invoxai_user_id;
  const notePlan = subEntity.notes?.invoxai_plan;

  const userId = sub?.user_id ?? noteUser;
  const planKey: PlanKey =
    (sub?.plan as PlanKey | undefined) ??
    (isPlanKey(notePlan) ? notePlan : "free");

  if (!userId) {
    // Unknown subscription — accept the webhook so Razorpay doesn't retry forever.
    return NextResponse.json({ ok: true, skipped: "unknown subscription" });
  }

  const ends = subEntity.current_end
    ? new Date(subEntity.current_end * 1000).toISOString()
    : null;

  switch (event) {
    case "subscription.activated":
    case "subscription.resumed":
    case "subscription.authenticated": {
      await admin
        .from("user_profiles")
        .update({
          subscription_plan: planKey,
          subscription_status: "active",
          subscription_ends_at: ends,
        })
        .eq("id", userId);

      if (sub?.id) {
        await admin
          .from("user_subscriptions")
          .update({ status: "active", ends_at: ends })
          .eq("id", sub.id);
      }
      break;
    }

    case "subscription.charged": {
      // Mirror the gross charge into the ledger.
      if (payEntity?.amount) {
        await admin.from("transactions").insert({
          user_id: userId,
          type: "subscription_payment",
          amount: payEntity.amount / 100,
          status: payEntity.status ?? "completed",
          reference_id: payEntity.id,
          notes: `Subscription ${subEntity.id}`,
        });
      }

      // Extend the end date for the new billing period.
      if (ends) {
        await admin
          .from("user_profiles")
          .update({ subscription_status: "active", subscription_ends_at: ends })
          .eq("id", userId);
      }
      break;
    }

    case "subscription.halted":
    case "subscription.pending": {
      await admin
        .from("user_profiles")
        .update({ subscription_status: "past_due" })
        .eq("id", userId);
      if (sub?.id) {
        await admin
          .from("user_subscriptions")
          .update({ status: "past_due" })
          .eq("id", sub.id);
      }
      break;
    }

    case "subscription.paused": {
      await admin
        .from("user_profiles")
        .update({ subscription_status: "past_due" })
        .eq("id", userId);
      if (sub?.id) {
        await admin
          .from("user_subscriptions")
          .update({ status: "paused" })
          .eq("id", sub.id);
      }
      break;
    }

    case "subscription.cancelled":
    case "subscription.deactivated":
    case "subscription.completed": {
      await admin
        .from("user_profiles")
        .update({
          subscription_status: "cancelled",
          subscription_plan: "free",
        })
        .eq("id", userId);
      if (sub?.id) {
        await admin
          .from("user_subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
      break;
    }

    default: {
      // Unknown event — log nothing, return 200 so Razorpay stops retrying.
      return NextResponse.json({ ok: true, ignored: event });
    }
  }

  return NextResponse.json({ ok: true });
}
