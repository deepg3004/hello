// POST /api/auth/phone/verify-otp
//
// Body: { otp: string }
//
// Compares the OTP against the hash stored by send-otp. On success the user's
// phone is marked verified (which unlocks the dashboard) and the pending number
// is promoted to the profile's phone. 5 attempts then the OTP is invalidated.

import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOtp } from "@/lib/twilio";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { otp?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const otp = (body.otp ?? "").trim();
  if (!/^\d{4,8}$/.test(otp)) {
    return NextResponse.json(
      { error: "Enter the code from your SMS." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "phone_verified, phone_pending_number, phone_otp_hash, phone_otp_expires_at, phone_otp_attempts",
    )
    .eq("id", user.id)
    .single();

  if (profile?.phone_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }
  if (!profile?.phone_otp_hash || !profile.phone_pending_number) {
    return NextResponse.json(
      { error: "No verification in progress. Request a new code." },
      { status: 400 },
    );
  }
  if (
    !profile.phone_otp_expires_at ||
    new Date(profile.phone_otp_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "Code expired. Request a new one." },
      { status: 400 },
    );
  }
  if ((profile.phone_otp_attempts ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }

  if (hashOtp(otp) !== profile.phone_otp_hash) {
    await admin
      .from("user_profiles")
      .update({ phone_otp_attempts: (profile.phone_otp_attempts ?? 0) + 1 })
      .eq("id", user.id);
    return NextResponse.json({ error: "Code didn't match." }, { status: 400 });
  }

  const { error: updateErr } = await admin
    .from("user_profiles")
    .update({
      phone: profile.phone_pending_number,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
      phone_pending_number: null,
      phone_otp_hash: null,
      phone_otp_expires_at: null,
      phone_otp_attempts: 0,
    })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
