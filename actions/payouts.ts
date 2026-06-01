"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/admin/audit";
import { requestPayout, processPayoutJob } from "@/lib/payouts";

export interface RequestPayoutResult {
  ok: boolean;
  message?: string;
  payout_id?: string;
  scheduled_at?: string;
}

/**
 * Seller-facing — requests a payout. All gating, balance math + scheduling
 * happens in lib/payouts.ts.requestPayout().
 */
export async function requestPayoutAction(
  amountRupees: number,
): Promise<RequestPayoutResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const result = await requestPayout({ userId: user.id, amountRupees });
  if (result.ok) revalidatePath("/dashboard/payouts");
  return result;
}

// ----------------------------------------------------------------------------
// Settings (seller)
// ----------------------------------------------------------------------------

export interface UpdatePayoutSettingsInput {
  schedule?: "manual" | "weekly" | "monthly";
  min_threshold?: number;
  gateway?: "razorpay" | "cashfree";
}

export interface SettingsResult {
  ok: boolean;
  message?: string;
}

export async function updatePayoutSettingsAction(
  input: UpdatePayoutSettingsInput,
): Promise<SettingsResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const update: Record<string, unknown> = {};
  if (input.schedule) update.payout_schedule = input.schedule;
  if (typeof input.min_threshold === "number") {
    if (input.min_threshold < 500) {
      return { ok: false, message: "Minimum threshold can't be below ₹500." };
    }
    update.payout_min_threshold = Math.floor(input.min_threshold);
  }
  if (input.gateway) update.payout_gateway = input.gateway;
  if (Object.keys(update).length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update(update)
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/payouts");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Admin actions
// ----------------------------------------------------------------------------

export interface AdminPayoutResult {
  ok: boolean;
  message?: string;
}

async function requireAdminUser(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { ok: false, message: "Admin only" };
  return { ok: true, userId: user.id };
}

/**
 * Approve a pending payout immediately — skips the admin-review delay.
 */
export async function approvePayoutAction(
  payoutId: string,
): Promise<AdminPayoutResult> {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  await admin
    .from("payouts")
    .update({
      scheduled_at: new Date(Date.now() - 1_000).toISOString(),
      approved_at: new Date().toISOString(),
      approved_by_admin_id: auth.userId,
    })
    .eq("id", payoutId)
    .eq("status", "pending");

  const result = await processPayoutJob(payoutId);

  await writeAuditLog({
    admin_id: auth.userId,
    action: "payout.approved",
    target_type: "payout",
    target_id: payoutId,
    details: { gateway: result.gateway, message: result.message },
  });

  revalidatePath("/admin/payouts");
  return result.ok
    ? { ok: true }
    : { ok: false, message: result.message ?? "Dispatch failed" };
}

/**
 * Cancel a pending payout — restores the seller's available balance by
 * flipping status to 'cancelled' (the balance calc only subtracts pending /
 * processing / completed).
 */
export async function rejectPayoutAction(
  payoutId: string,
  reason: string,
): Promise<AdminPayoutResult> {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  await admin
    .from("payouts")
    .update({
      status: "failed",
      failure_reason: reason || "Rejected by admin",
      cancelled_at: new Date().toISOString(),
      cancelled_by_admin_id: auth.userId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", payoutId)
    .in("status", ["pending", "processing"]);

  await writeAuditLog({
    admin_id: auth.userId,
    action: "payout.rejected",
    target_type: "payout",
    target_id: payoutId,
    details: { reason },
  });

  // Email the seller that the payout was returned (best-effort).
  try {
    const { data: p } = await admin
      .from("payouts")
      .select("user_id, amount")
      .eq("id", payoutId)
      .single();
    if (p?.user_id) {
      const { data: prof } = await admin
        .from("user_profiles")
        .select("email, full_name")
        .eq("id", p.user_id)
        .single();
      if (prof?.email) {
        const { enqueueEmail } = await import("@/lib/queues/email");
        await enqueueEmail({
          template: "payout_failed",
          to: prof.email,
          data: {
            seller_name: prof.full_name,
            amount: Number(p.amount ?? 0),
            reason: reason || "Rejected by admin",
          },
        });
      }
    }
  } catch {
    /* best-effort */
  }

  revalidatePath("/admin/payouts");
  return { ok: true };
}

/**
 * For sellers without Razorpay Route — admin marks the payout as completed
 * after settling via NEFT or similar.
 */
export async function markPayoutCompletedAction(
  payoutId: string,
  utr: string,
): Promise<AdminPayoutResult> {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("payouts")
    .select("user_id, amount, status")
    .eq("id", payoutId)
    .single();
  if (!payout) return { ok: false, message: "Not found" };

  await admin
    .from("payouts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      gateway_payout_id: utr || null,
      notes: utr ? `Manual settlement, UTR ${utr}` : "Manual settlement",
    })
    .eq("id", payoutId);

  await admin.from("transactions").insert({
    user_id: payout.user_id,
    type: "payout",
    amount: -Number(payout.amount ?? 0),
    status: "completed",
    reference_id: utr || null,
    notes: "Manual payout settled by admin",
  });

  await writeAuditLog({
    admin_id: auth.userId,
    action: "payout.marked_completed",
    target_type: "payout",
    target_id: payoutId,
    details: { utr },
  });

  // Email the seller their payout receipt (best-effort).
  try {
    const { data: prof } = await admin
      .from("user_profiles")
      .select("email, full_name, bank_account_number")
      .eq("id", payout.user_id)
      .single();
    if (prof?.email) {
      const { enqueueEmail } = await import("@/lib/queues/email");
      await enqueueEmail({
        template: "payout_completed",
        to: prof.email,
        data: {
          seller_name: prof.full_name,
          amount: Number(payout.amount ?? 0),
          bank_last4: (prof.bank_account_number ?? "").slice(-4) || null,
          utr: utr || null,
        },
      });
    }
  } catch {
    /* best-effort — never block the payout on email */
  }

  revalidatePath("/admin/payouts");
  return { ok: true };
}
