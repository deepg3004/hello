// POST /api/notifications/confirm-whatsapp
//
// Body: { otp: string }
//
// Compares the OTP against the hash stored by verify-whatsapp. On success:
//   - whatsapp_verified_number  = the pending number
//   - whatsapp_verified_at      = now
//   - notifications_config.whatsapp_number = the pending number
//   - notifications_config.enabled = true
//   - all otp/pending columns cleared
//
// 5 attempts then the OTP is invalidated.

import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOtp } from "@/lib/twilio";
import type { NotificationsConfig } from "@/lib/notifications-config";

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
    return NextResponse.json({ error: "Enter the OTP from your SMS." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "whatsapp_pending_number, whatsapp_otp_hash, whatsapp_otp_expires_at, whatsapp_otp_attempts, notifications_config",
    )
    .eq("id", user.id)
    .single();
  if (!profile?.whatsapp_otp_hash || !profile.whatsapp_pending_number) {
    return NextResponse.json(
      { error: "No verification in progress. Request a new OTP." },
      { status: 400 },
    );
  }
  if (
    !profile.whatsapp_otp_expires_at ||
    new Date(profile.whatsapp_otp_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "OTP expired. Request a new one." },
      { status: 400 },
    );
  }
  if ((profile.whatsapp_otp_attempts ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new OTP." },
      { status: 429 },
    );
  }

  const submittedHash = hashOtp(otp);
  if (submittedHash !== profile.whatsapp_otp_hash) {
    await admin
      .from("user_profiles")
      .update({
        whatsapp_otp_attempts: (profile.whatsapp_otp_attempts ?? 0) + 1,
      })
      .eq("id", user.id);
    return NextResponse.json({ error: "OTP didn't match." }, { status: 400 });
  }

  // Success — promote pending → verified, enable WhatsApp.
  const verifiedNumber = profile.whatsapp_pending_number;
  const cfg: NotificationsConfig =
    (profile.notifications_config as NotificationsConfig | null) ?? {};
  const nextCfg: NotificationsConfig = {
    ...cfg,
    enabled: true,
    whatsapp_number: verifiedNumber,
  };

  const verifiedAt = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("user_profiles")
    .update({
      whatsapp_verified_number: verifiedNumber,
      whatsapp_verified_at: verifiedAt,
      whatsapp_pending_number: null,
      whatsapp_otp_hash: null,
      whatsapp_otp_expires_at: null,
      whatsapp_otp_attempts: 0,
      notifications_config: nextCfg,
    })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    success: true,
    whatsapp_number: verifiedNumber,
    verified_at: verifiedAt,
  });
}
