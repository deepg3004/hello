// POST /api/kyc/create-linked-account
//
// Body: { user_id: string }
//
// Pre-conditions:
//   - user_profiles row exists
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
import { createLinkedAccount } from "@/lib/razorpay";

export async function POST(request: Request) {
  let body: { user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { user_id } = body;
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("user_profiles")
    .select(
      "id, email, full_name, phone, kyc_level, bank_verified, bank_account_number, bank_ifsc, bank_holder_name, razorpay_linked_account_id",
    )
    .eq("id", user_id)
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
      notes: { invoxai_user_id: user_id },
    });
    accountId = account.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await admin
    .from("user_profiles")
    .update({ razorpay_linked_account_id: accountId, payouts_enabled: true })
    .eq("id", user_id);

  return NextResponse.json({ ok: true, linked_account_id: accountId });
}
