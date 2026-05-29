"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payouts";

export interface RequestPayoutResult {
  ok: boolean;
  message?: string;
  payout_id?: string;
}

/**
 * Queue a payout request. We do NOT actually call the Razorpay payout API
 * here — production payouts are dispatched by a separate worker after admin
 * review. This action just persists the request.
 */
export async function requestPayoutAction(
  amountRupees: number,
): Promise<RequestPayoutResult> {
  if (!Number.isFinite(amountRupees) || amountRupees < MIN_PAYOUT_AMOUNT) {
    return { ok: false, message: `Minimum payout is ₹${MIN_PAYOUT_AMOUNT}` };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();

  // Eligibility — bank verified + KYC level 2
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "id, kyc_level, bank_verified, bank_account_number, bank_ifsc, payouts_enabled",
    )
    .eq("id", user.id)
    .single();

  if (!profile) return { ok: false, message: "Profile not found" };
  if (!profile.bank_verified || (profile.kyc_level ?? 0) < 2) {
    return {
      ok: false,
      message: "Complete KYC level 2 (bank verification) to request payouts",
    };
  }

  // Available balance check — same calc as the page.
  const [{ data: paid }, { data: completed }] = await Promise.all([
    admin
      .from("orders")
      .select("seller_amount")
      .eq("seller_user_id", user.id)
      .eq("status", "paid"),
    admin
      .from("payouts")
      .select("amount, status")
      .eq("user_id", user.id)
      .in("status", ["queued", "processing", "completed"]),
  ]);
  const gross = (paid ?? []).reduce((acc, r) => acc + Number(r.seller_amount ?? 0), 0);
  const reserved = (completed ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
  const available = Math.max(0, gross - reserved);

  if (amountRupees > available) {
    return {
      ok: false,
      message: `You only have ₹${available.toLocaleString("en-IN")} available.`,
    };
  }

  const last4 = (profile.bank_account_number ?? "").slice(-4);
  const { data: inserted, error } = await admin
    .from("payouts")
    .insert({
      user_id: user.id,
      amount: amountRupees,
      status: "queued",
      gateway: "razorpay",
      bank_account: last4,
      bank_ifsc: profile.bank_ifsc,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Couldn't queue payout" };
  }

  revalidatePath("/dashboard/payouts");
  return { ok: true, payout_id: inserted.id };
}
