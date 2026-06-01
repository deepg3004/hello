// =============================================================================
// Payout pipeline — balance math + dispatch.
//
// This file is shared between server actions, the cron dispatcher, and the
// webhook handler. None of the exports are server-actions themselves so it
// can also re-export simple constants for client components.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { createPayout as razorpayPayout } from "@/lib/razorpay";
import {
  isCashfreeConfigured,
  requestTransfer as cashfreeTransfer,
  upsertBeneficiary as cashfreeBeneficiary,
} from "@/lib/payouts/cashfree";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const MIN_PAYOUT_AMOUNT = 500; // INR — the platform minimum (can be raised per-seller)
/** Hold every paid order for this many days before it becomes payable. */
export const CHARGEBACK_HOLD_DAYS = 3;
/** Admin window between request and dispatch. */
export const DISPATCH_DELAY_MINUTES = 5;

// ----------------------------------------------------------------------------
// Balance math
// ----------------------------------------------------------------------------

export interface AvailableBalance {
  available_balance: number;
  pending_clearance: number;
  total_paid_out: number;
  in_flight: number; // already-requested but not yet completed
}

/**
 * Returns a seller's payout balance broken down into available / clearing /
 * paid-out / in-flight buckets. Money under the 3-day chargeback hold sits
 * in `pending_clearance`.
 */
export async function calculateAvailableBalance(
  userId: string,
): Promise<AvailableBalance> {
  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - CHARGEBACK_HOLD_DAYS * 86_400_000,
  ).toISOString();

  const [{ data: clearedOrders }, { data: holdingOrders }, { data: payouts }] =
    await Promise.all([
      admin
        .from("orders")
        .select("seller_amount")
        .eq("seller_user_id", userId)
        .eq("status", "paid")
        .lt("created_at", cutoff),
      admin
        .from("orders")
        .select("seller_amount")
        .eq("seller_user_id", userId)
        .eq("status", "paid")
        .gte("created_at", cutoff),
      admin
        .from("payouts")
        .select("amount, status")
        .eq("user_id", userId),
    ]);

  const clearedGross = (clearedOrders ?? []).reduce(
    (a, r) => a + Number(r.seller_amount ?? 0),
    0,
  );
  const pendingClearance = (holdingOrders ?? []).reduce(
    (a, r) => a + Number(r.seller_amount ?? 0),
    0,
  );

  let totalPaidOut = 0;
  let inFlight = 0;
  for (const p of payouts ?? []) {
    const amt = Number(p.amount ?? 0);
    if (p.status === "completed") totalPaidOut += amt;
    else if (p.status === "pending" || p.status === "processing")
      inFlight += amt;
  }

  return {
    available_balance: Math.max(0, clearedGross - totalPaidOut - inFlight),
    pending_clearance: pendingClearance,
    total_paid_out: totalPaidOut,
    in_flight: inFlight,
  };
}

// ----------------------------------------------------------------------------
// Request a payout
// ----------------------------------------------------------------------------

export interface RequestPayoutInput {
  userId: string;
  amountRupees: number;
  /** Optional override — defaults to seller's preferred gateway. */
  gateway?: "razorpay" | "cashfree" | "manual";
}

export interface RequestPayoutResult {
  ok: boolean;
  message?: string;
  payout_id?: string;
  scheduled_at?: string;
}

/**
 * Run all gating + reservation logic and insert a pending payout row.
 * The cron dispatcher picks it up after `DISPATCH_DELAY_MINUTES`.
 */
export async function requestPayout(
  input: RequestPayoutInput,
): Promise<RequestPayoutResult> {
  if (!Number.isFinite(input.amountRupees)) {
    return { ok: false, message: "Invalid amount" };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "id, kyc_level, bank_verified, bank_account_number, bank_ifsc, bank_holder_name, payouts_enabled, payout_gateway, payout_min_threshold, razorpay_linked_account_id, cashfree_beneficiary_id, email, phone",
    )
    .eq("id", input.userId)
    .single();
  if (!profile) return { ok: false, message: "Profile not found" };

  if (!profile.payouts_enabled || (profile.kyc_level ?? 0) < 2 || !profile.bank_verified) {
    return {
      ok: false,
      message: "Complete KYC level 2 (PAN + bank) to enable payouts.",
    };
  }

  const { getMinPayoutAmount } = await import("@/lib/settings");
  const platformMin = await getMinPayoutAmount();
  const sellerMin = Math.max(
    platformMin,
    Number(profile.payout_min_threshold ?? platformMin),
  );
  if (input.amountRupees < sellerMin) {
    return {
      ok: false,
      message: `Minimum payout is ₹${sellerMin}.`,
    };
  }

  // Prevent overlapping requests.
  const { count: pending } = await admin
    .from("payouts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .in("status", ["pending", "processing"]);
  if ((pending ?? 0) > 0) {
    return {
      ok: false,
      message: "You already have a payout in flight. Wait for it to settle.",
    };
  }

  const balance = await calculateAvailableBalance(input.userId);
  if (input.amountRupees > balance.available_balance) {
    return {
      ok: false,
      message: `You only have ₹${balance.available_balance.toLocaleString("en-IN")} available.`,
    };
  }

  const gateway = input.gateway ?? (profile.payout_gateway ?? "razorpay");
  const scheduledAt = new Date(Date.now() + DISPATCH_DELAY_MINUTES * 60_000).toISOString();
  const last4 = (profile.bank_account_number ?? "").slice(-4);

  const { data: inserted, error } = await admin
    .from("payouts")
    .insert({
      user_id: input.userId,
      amount: input.amountRupees,
      status: "pending",
      gateway,
      bank_account: last4,
      bank_ifsc: profile.bank_ifsc,
      scheduled_at: scheduledAt,
      reference_id: `invoxai_${Date.now()}_${input.userId.slice(0, 8)}`,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Couldn't queue payout" };
  }

  // Best-effort confirmation email + WhatsApp.
  void notifyPayoutInitiatedLocal(input.userId, input.amountRupees, inserted.id);

  return { ok: true, payout_id: inserted.id, scheduled_at: scheduledAt };
}

async function notifyPayoutInitiatedLocal(
  userId: string,
  amount: number,
  payoutId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("email, full_name, bank_account_number")
      .eq("id", userId)
      .single();
    if (!profile) return;

    const { sendEmail } = await import("@/lib/email");
    const subject = `Payout initiated — ₹${amount.toLocaleString("en-IN")}`;
    const body = `Hi ${profile.full_name ?? ""},\n\nYour payout of ₹${amount.toLocaleString("en-IN")} has been initiated. It will land in your bank account in 2–4 hours.\n\n— InvoxAI`;
    await sendEmail({
      to: profile.email,
      subject,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">${body
        .replace(/\n/g, "<br/>")
        .replace(/&/g, "&amp;")}</div>`,
    });

    // WhatsApp via the preference-aware trigger (respects toggles + verified
    // number on user_profiles).
    const { notifyPayoutInitiated } = await import("@/lib/notification-triggers");
    void notifyPayoutInitiated({
      user_id: userId,
      amount,
      bank_last4: (profile.bank_account_number ?? "").slice(-4) || null,
      payout_id: payoutId,
    });
  } catch (e) {
    console.error("[payouts] notifyPayoutInitiated failed", e);
  }
}

// ----------------------------------------------------------------------------
// Process a single payout (called by cron dispatcher + admin approval)
// ----------------------------------------------------------------------------

export interface ProcessResult {
  ok: boolean;
  message?: string;
  /** Mode used in the dispatch attempt. */
  gateway?: "razorpay" | "cashfree" | "manual";
}

/**
 * Pick up a queued payout row and dispatch via the seller's preferred gateway.
 * Idempotent — refuses to act on rows not in `pending` status.
 */
export async function processPayoutJob(payoutId: string): Promise<ProcessResult> {
  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("payouts")
    .select(
      "id, user_id, amount, status, gateway, reference_id, scheduled_at",
    )
    .eq("id", payoutId)
    .single();
  if (!payout) return { ok: false, message: "Payout not found" };
  if (payout.status !== "pending") {
    return { ok: false, message: `Payout already ${payout.status}` };
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, bank_account_number, bank_ifsc, bank_holder_name, cashfree_beneficiary_id, razorpay_linked_account_id",
    )
    .eq("id", payout.user_id)
    .single();
  if (!profile) {
    await failPayout(payoutId, "Seller profile missing");
    return { ok: false, message: "Seller profile missing" };
  }

  // Flip to processing first so a slow gateway can't cause double-dispatch.
  await admin
    .from("payouts")
    .update({ status: "processing" })
    .eq("id", payoutId)
    .eq("status", "pending");

  const gateway = (payout.gateway ?? "razorpay") as ProcessResult["gateway"];

  if (gateway === "manual") {
    // Manual mode — leave processing for admin to mark completed.
    return { ok: true, gateway: "manual", message: "Awaiting manual settlement." };
  }

  if (gateway === "cashfree") {
    if (!isCashfreeConfigured()) {
      await failPayout(payoutId, "Cashfree not configured");
      return { ok: false, message: "Cashfree not configured", gateway };
    }
    try {
      const beneId =
        profile.cashfree_beneficiary_id ?? `invoxai_${profile.id.slice(0, 12)}`;

      if (!profile.cashfree_beneficiary_id) {
        await cashfreeBeneficiary({
          beneId,
          name: profile.bank_holder_name ?? profile.full_name ?? "Seller",
          email: profile.email,
          phone: profile.phone ?? "9999999999",
          bankAccount: profile.bank_account_number ?? "",
          ifsc: profile.bank_ifsc ?? "",
        });
        await admin
          .from("user_profiles")
          .update({ cashfree_beneficiary_id: beneId })
          .eq("id", profile.id);
      }

      const transfer = await cashfreeTransfer({
        transferId: payout.reference_id ?? payout.id,
        beneId,
        amount: Number(payout.amount),
      });
      if (!transfer.ok) {
        await failPayout(payoutId, transfer.message ?? "Cashfree transfer failed");
        return { ok: false, message: transfer.message, gateway };
      }
      await admin
        .from("payouts")
        .update({
          gateway_payout_id: transfer.data?.referenceId ?? null,
          gateway_dispatch_payload: { transferId: payout.reference_id },
        })
        .eq("id", payoutId);
      return { ok: true, gateway };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await failPayout(payoutId, msg);
      return { ok: false, message: msg, gateway };
    }
  }

  // Default — Razorpay
  const sourceAccount = process.env.RAZORPAY_CURRENT_ACCOUNT;
  if (!sourceAccount) {
    await failPayout(payoutId, "RAZORPAY_CURRENT_ACCOUNT not set");
    return { ok: false, message: "RAZORPAY_CURRENT_ACCOUNT not set", gateway };
  }
  if (!profile.bank_account_number || !profile.bank_ifsc) {
    await failPayout(payoutId, "Bank details missing on profile");
    return { ok: false, message: "Bank details missing", gateway };
  }

  try {
    // Razorpay needs a fund_account_id. We expect the linked-account flow to
    // have created one; for plain payouts callers can also pass an existing
    // fund_account_id stored elsewhere. For now, fail with a clear message if
    // it isn't set up.
    const fundAccountId = profile.razorpay_linked_account_id;
    if (!fundAccountId) {
      await failPayout(payoutId, "Razorpay fund account not set up");
      return { ok: false, message: "Razorpay fund account not set up", gateway };
    }
    const payload = await razorpayPayout({
      account_number: sourceAccount,
      fund_account_id: fundAccountId,
      amount: Math.round(Number(payout.amount) * 100),
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      reference_id: payout.reference_id ?? undefined,
      narration: "InvoxAI Earnings Payout",
    });
    const gateway_payout_id =
      (payload as { id?: string }).id ?? null;
    await admin
      .from("payouts")
      .update({
        gateway_payout_id,
        gateway_dispatch_payload: payload as unknown as Record<string, unknown>,
      })
      .eq("id", payoutId);
    return { ok: true, gateway };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failPayout(payoutId, msg);
    return { ok: false, message: msg, gateway };
  }
}

async function failPayout(payoutId: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("payouts")
    .update({
      status: "failed",
      failure_reason: reason,
      completed_at: new Date().toISOString(),
    })
    .eq("id", payoutId);

  try {
    const { data: payout } = await admin
      .from("payouts")
      .select("user_id, amount, user_profiles(email, full_name)")
      .eq("id", payoutId)
      .single();
    const profile = Array.isArray(
      (payout as unknown as { user_profiles: unknown }).user_profiles,
    )
      ? (payout as unknown as { user_profiles: Array<{ email: string; full_name: string | null }> }).user_profiles[0]
      : (payout as unknown as { user_profiles: { email: string; full_name: string | null } | null }).user_profiles;
    if (profile) {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: profile.email,
        subject: `Payout failed — please retry`,
        html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">Hi ${
          profile.full_name ?? ""
        },<br/>Your payout of ₹${Number((payout as { amount: number }).amount).toLocaleString(
          "en-IN",
        )} failed. Reason: ${reason}. The amount has been returned to your available balance — please try again or contact support.</div>`,
      });
    }
  } catch {
    /* notification failure is non-fatal */
  }
}
