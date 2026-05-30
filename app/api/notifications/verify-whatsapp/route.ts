// POST /api/notifications/verify-whatsapp
//
// Body: { phone: string }     (E.164, '+' optional, digits only)
//
// Generates a 6-digit OTP, hashes it, stores hash + 10-min expiry on the
// seller's profile, and SMS-delivers the plaintext OTP via MSG91. The seller
// later POSTs to /api/notifications/confirm-whatsapp with the OTP to finalise.

import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtp, hashOtp, sendSms } from "@/lib/twilio";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

function normalisePhone(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phone = normalisePhone(body.phone ?? "");
  if (phone.length < 10 || phone.length > 15) {
    return NextResponse.json(
      { error: "Enter a valid phone number with country code." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  // Cool-down check so we don't spam OTPs.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("whatsapp_otp_expires_at, whatsapp_pending_number")
    .eq("id", user.id)
    .single();
  if (profile?.whatsapp_otp_expires_at) {
    const lastIssuedAt =
      new Date(profile.whatsapp_otp_expires_at).getTime() - OTP_TTL_MS;
    if (Date.now() - lastIssuedAt < RESEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Please wait a minute before requesting another OTP." },
        { status: 429 },
      );
    }
  }

  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: updateErr } = await admin
    .from("user_profiles")
    .update({
      whatsapp_pending_number: phone,
      whatsapp_otp_hash: otpHash,
      whatsapp_otp_expires_at: expiresAt,
      whatsapp_otp_attempts: 0,
    })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Deliver via SMS. Best-effort — but if no MSG91 key, we leak the otp in
  // dev so the developer can still test.
  const sms = await sendSms({
    to: phone,
    message: `${otp} is your InvoxAI WhatsApp verification code. It expires in 10 minutes.`,
  });
  if (!sms.ok && !sms.skipped) {
    return NextResponse.json(
      { error: `Couldn't send OTP: ${sms.message ?? "SMS gateway failed"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    success: true,
    expires_at: expiresAt,
    // In dev/sandbox (no MSG91) we surface the OTP so the seller can test the
    // flow end-to-end without a real SMS round-trip.
    dev_otp:
      process.env.NODE_ENV !== "production" && sms.skipped ? otp : undefined,
  });
}
