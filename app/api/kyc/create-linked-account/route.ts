// POST /api/kyc/create-linked-account
//
// AUTH (SECURITY): The user_id is ALWAYS resolved from the Supabase session.
// Previously this route trusted body.user_id, letting any unauthenticated
// caller create a Razorpay Route linked account against any user_id and
// flip their payouts_enabled flag — effectively hijacking the seller's
// payout destination.
//
// Pre-conditions:
//   - logged-in seller
//   - user_profiles row exists for the session user
//   - kyc_level >= 2 (bank verified)
//   - bank_account_number, bank_ifsc, bank_holder_name are set
//   - razorpay_linked_account_id is NULL (idempotency)
//
// Side effects:
//   - Calls Razorpay /v2/accounts → linked account id
//   - Persists razorpay_linked_account_id on the profile
//   - Sets payouts_enabled = TRUE

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createLinkedAccount } from "@/lib/razorpay";

export async function POST() {
  // ── AuthN — the only acceptable source for user_id ───────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = user.id;

  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("user_profiles")
    .select(
      "id, email, full_name, phone, kyc_level, bank_verified, bank_account_number, bank_ifsc, bank_holder_name, razorpay_linked_account_id",
    )
    .eq("id", userId)
    .single();
  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Idempotency.
  if (profile.razorpay_linked_account_id) {
    return NextResponse.json({
      ok: true,
      linked_account_id: profile.razorpay_linked_account_id,
      reused: true,
    });
  }

  // Eligibility.
  if ((profile.kyc_level ?? 0) < 2 || !profile.bank_verified) {
    return NextResponse.json(
      { error: "KYC level 2 (bank verified) required" },
      { status: 403 },
    );
  }
  if (
    !profile.bank_account_number ||
    !profile.bank_ifsc ||
    !profile.bank_holder_name
  ) {
    return NextResponse.json(
      { error: "Bank details missing" },
      { status: 400 },
    );
  }
  if (!profile.email) {
    return NextResponse.json({ error: "Email missing" }, { status: 400 });
  }

  let accountId: string;
  try {
    const account = await createLinkedAccount({
      email: profile.email,
      name: profile.full_name ?? profile.bank_holder_name,
      contact: profile.phone ?? undefined,
      business_name: profile.full_name ?? "InvoxAI Seller",
      bank: {
        account_number: profile.bank_account_number,
        ifsc_code: profile.bank_ifsc,
        beneficiary_name: profile.bank_holder_name,
      },
      notes: { invoxai_user_id: userId },
    });
    accountId = account.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await admin
    .from("user_profiles")
    .update({ razorpay_linked_account_id: accountId, payouts_enabled: true })
    .eq("id", userId);

  return NextResponse.json({ ok: true, linked_account_id: accountId });
}
