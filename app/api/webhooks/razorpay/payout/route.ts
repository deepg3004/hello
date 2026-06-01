// POST /api/webhooks/razorpay/payout
//
// Razorpay payout lifecycle webhook:
//   payout.processed → mark our row completed + ledger row + notify seller
//   payout.reversed  → mark failed + notify seller + admin
//
// Configure in Razorpay dashboard → Settings → Webhooks:
//   URL: https://app.invoxai.io/api/webhooks/razorpay/payout
//   Events: payout.processed, payout.reversed, payout.failed
//   Secret: RAZORPAY_WEBHOOK_SECRET (shared with the other RP webhooks)

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { sendEmail as sendTemplate } from "@/lib/emails/send";

interface PayoutEntity {
  id: string;
  amount: number;
  fund_account_id?: string;
  reference_id?: string;
  utr?: string;
  status?: string;
  failure_reason?: string;
}

interface WebhookPayload {
  event: string;
  payload: { payout?: { entity: PayoutEntity } };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const event = body.event;
  const payout = body.payload?.payout?.entity;
  if (!payout?.id) {
    return NextResponse.json({ ok: true, skipped: "no payout entity" });
  }

  const admin = createAdminClient();

  // Match on gateway_payout_id, fall back to reference_id.
  const { data: row } = await admin
    .from("payouts")
    .select("id, user_id, amount, status, gateway_payout_id, reference_id")
    .or(
      `gateway_payout_id.eq.${payout.id},reference_id.eq.${payout.reference_id ?? "__none__"}`,
    )
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ ok: true, skipped: "unknown payout" });
  }

  switch (event) {
    case "payout.processed": {
      if (row.status !== "completed") {
        await admin
          .from("payouts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            gateway_payout_id: payout.id,
          })
          .eq("id", row.id);

        await admin.from("transactions").insert({
          user_id: row.user_id,
          type: "payout",
          amount: -Number(row.amount ?? 0),
          status: "completed",
          reference_id: payout.utr ?? payout.id,
          notes: `Payout settled (${payout.utr ?? payout.id})`,
        });

        void notifyCompleted(row.user_id, Number(row.amount ?? 0), payout.utr);
        // WhatsApp ping to the seller — best-effort, never throws.
        try {
          const { notifyPayoutComplete } = await import(
            "@/lib/notification-triggers"
          );
          void notifyPayoutComplete({
            user_id: row.user_id,
            amount: Number(row.amount ?? 0),
            payout_id: payout.id,
            utr: payout.utr ?? null,
          });
        } catch (e) {
          console.error("[payout-webhook] notifyPayoutComplete dispatch", e);
        }
      }
      break;
    }
    case "payout.reversed":
    case "payout.failed": {
      await admin
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: payout.failure_reason ?? `Razorpay event: ${event}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      void notifyFailed(
        row.user_id,
        Number(row.amount ?? 0),
        payout.failure_reason ?? event,
      );
      break;
    }
    default: {
      return NextResponse.json({ ok: true, ignored: event });
    }
  }

  return NextResponse.json({ ok: true });
}

async function notifyCompleted(userId: string, amount: number, utr?: string) {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();
    if (!profile) return;
    // Proper templated payout receipt (premium shell + amount/UTR breakdown).
    await sendTemplate("payout_completed", profile.email, {
      seller_name: profile.full_name,
      amount,
      utr: utr ?? null,
    });
  } catch (e) {
    console.error("[payout-webhook] notifyCompleted failed", e);
  }
}

async function notifyFailed(userId: string, amount: number, reason: string) {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();
    if (!profile) return;
    await sendTemplate("payout_failed", profile.email, {
      seller_name: profile.full_name,
      amount,
      reason,
    });
  } catch (e) {
    console.error("[payout-webhook] notifyFailed failed", e);
  }
}
