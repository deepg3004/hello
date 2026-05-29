// POST /api/webhooks/razorpay/subscription
//
// Razorpay subscription lifecycle webhook.
//
// 1. Verify X-Razorpay-Signature against RAZORPAY_WEBHOOK_SECRET (HMAC-SHA256).
// 2. On subscription.activated → mark user as active on the chosen plan.
// 3. On subscription.charged   → insert a transaction row.
// 4. On subscription.halted / .deactivated / .cancelled / .paused → update.
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

interface WebhookPayload {
  event: string;
  payload: {
    subscription?: { entity: SubscriptionEntity };
    payment?: { entity: PaymentEntity };
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

  // We need a subscription to do anything meaningful.
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
