// POST /api/auth/phone/send-otp
//
// Body: { phone?: string }   (optional — defaults to the number from signup)
//
// Generates a 6-digit OTP, hashes it, stores hash + 10-min expiry on the user's
// profile, and SMS-delivers the plaintext OTP via Twilio. The user then POSTs
// to /api/auth/phone/verify-otp to finalise. Mirrors the WhatsApp verify flow.

import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtp, hashOtp, sendSms } from "@/lib/twilio";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

function normalisePhone(input: string): string {
  return input.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "");
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
    body = {};
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("phone, phone_verified, phone_otp_expires_at, phone_pending_number")
    .eq("id", user.id)
    .single();

  if (profile?.phone_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const phone = normalisePhone(body.phone || profile?.phone || "");
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json(
      { error: "Enter a valid phone number with country code." },
      { status: 400 },
    );
  }

  // Cool-down so we don't spam OTPs.
  if (profile?.phone_otp_expires_at) {
    const lastIssuedAt =
      new Date(profile.phone_otp_expires_at).getTime() - OTP_TTL_MS;
    if (Date.now() - lastIssuedAt < RESEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Please wait a minute before requesting another code." },
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
      phone_pending_number: phone,
      phone_otp_hash: otpHash,
      phone_otp_expires_at: expiresAt,
      phone_otp_attempts: 0,
    })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const sms = await sendSms({
    to: phone,
    message: `Your InvoxAI verification code is ${otp}. It expires in 10 minutes.`,
  });

  // No Twilio configured (dev) — surface the OTP so the flow is testable.
  if (sms.skipped) {
    const devOtp =
      process.env.NODE_ENV !== "production" ? { devOtp: otp } : {};
    return NextResponse.json({ ok: true, smsSkipped: true, ...devOtp });
  }
  if (!sms.ok) {
    return NextResponse.json(
      { error: sms.message ?? "Couldn't send the SMS. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, phone });
}
