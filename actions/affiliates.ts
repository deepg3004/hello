"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import type {
  AffiliateProgramStatus,
  CommissionType,
} from "@/lib/affiliate";

interface Ok {
  ok: true;
  message?: string;
}
interface Err {
  ok: false;
  message: string;
}
type Result = Ok | Err;

// ---------------------------------------------------------------------------
// Enable / update / pause the program for a single page
// ---------------------------------------------------------------------------

export async function upsertAffiliateProgramAction(input: {
  page_id: string;
  commission_type: CommissionType;
  commission_value: number;
  terms?: string;
  status?: AffiliateProgramStatus;
}): Promise<Result> {
  const actor = await requireActor("affiliates.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  if (
    input.commission_type !== "percentage" &&
    input.commission_type !== "fixed"
  ) {
    return { ok: false, message: "commission_type must be percentage or fixed" };
  }
  if (!Number.isFinite(input.commission_value) || input.commission_value < 0) {
    return { ok: false, message: "commission_value must be ≥ 0" };
  }
  if (input.commission_type === "percentage" && input.commission_value > 100) {
    return { ok: false, message: "commission % can't exceed 100" };
  }

  const admin = createAdminClient();
  // Ownership check.
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id")
    .eq("id", input.page_id)
    .single();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Not your page" };
  }

  // Upsert.
  const { data: existing } = await admin
    .from("affiliates")
    .select("id")
    .eq("user_id", ctx.ownerId)
    .eq("page_id", input.page_id)
    .maybeSingle();

  const fields = {
    user_id: ctx.ownerId,
    page_id: input.page_id,
    commission_type: input.commission_type,
    commission_value: input.commission_value,
    terms: input.terms ?? null,
    status: (input.status ?? "active") as AffiliateProgramStatus,
  };
  if (existing) {
    const { error } = await admin
      .from("affiliates")
      .update(fields)
      .eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await admin.from("affiliates").insert(fields);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/affiliates");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mark a payout as paid (manual or after a successful bank transfer)
// ---------------------------------------------------------------------------

export async function markAffiliatePayoutPaidAction(input: {
  payout_id: string;
  /** UTR / Razorpay payout id / "manual" — surfaces in the affiliate's
   *  portal so they can reconcile against their bank statement. */
  payment_reference: string;
}): Promise<Result> {
  const actor = await requireActor("affiliates.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("affiliate_payouts")
    .select(
      "id, seller_user_id, status, commission_amount, affiliate_link_id",
    )
    .eq("id", input.payout_id)
    .single();
  if (!payout || payout.seller_user_id !== ctx.ownerId) {
    return { ok: false, message: "Payout not yours" };
  }
  if (payout.status !== "pending") {
    return { ok: false, message: `Already ${payout.status}` };
  }
  if (!input.payment_reference.trim()) {
    return { ok: false, message: "Payment reference required" };
  }

  const { error } = await admin
    .from("affiliate_payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_reference: input.payment_reference.trim(),
    })
    .eq("id", payout.id);
  if (error) return { ok: false, message: error.message };

  // Roll up the link's paid total so the portal can show outstanding vs paid.
  const { data: existing } = await admin
    .from("affiliate_links")
    .select("paid_amount")
    .eq("id", payout.affiliate_link_id)
    .single();
  if (existing) {
    await admin
      .from("affiliate_links")
      .update({
        paid_amount:
          Number(existing.paid_amount ?? 0) + Number(payout.commission_amount),
      })
      .eq("id", payout.affiliate_link_id);
  }

  revalidatePath("/dashboard/affiliates");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pay everything outstanding for a single affiliate in one click
// ---------------------------------------------------------------------------

export async function payAffiliateAllOutstandingAction(input: {
  affiliate_link_id: string;
  payment_reference: string;
}): Promise<Result> {
  const actor = await requireActor("affiliates.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;
  if (!input.payment_reference.trim()) {
    return { ok: false, message: "Payment reference required" };
  }

  const admin = createAdminClient();
  const { data: payouts } = await admin
    .from("affiliate_payouts")
    .select("id, seller_user_id, commission_amount, affiliate_link_id")
    .eq("affiliate_link_id", input.affiliate_link_id)
    .eq("status", "pending");

  if (!payouts || payouts.length === 0) {
    return { ok: false, message: "Nothing to pay" };
  }
  if (payouts[0]!.seller_user_id !== ctx.ownerId) {
    return { ok: false, message: "Not your affiliate" };
  }

  const total = payouts.reduce(
    (sum, p) => sum + Number(p.commission_amount ?? 0),
    0,
  );
  const ref = input.payment_reference.trim();
  const nowIso = new Date().toISOString();

  await admin
    .from("affiliate_payouts")
    .update({ status: "paid", paid_at: nowIso, payment_reference: ref })
    .in(
      "id",
      payouts.map((p) => p.id),
    );

  const { data: existing } = await admin
    .from("affiliate_links")
    .select("paid_amount")
    .eq("id", input.affiliate_link_id)
    .single();
  if (existing) {
    await admin
      .from("affiliate_links")
      .update({
        paid_amount: Number(existing.paid_amount ?? 0) + total,
      })
      .eq("id", input.affiliate_link_id);
  }

  revalidatePath("/dashboard/affiliates");
  return { ok: true };
}
