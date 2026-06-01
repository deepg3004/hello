// POST /api/affiliate/portal/request-otp
//
// Body: { email }
//
// Sends a 6-digit OTP to an affiliate's registered email. We only accept
// emails that already appear on at least one affiliate_links row — anyone
// else trying to log in gets the same "we sent you a code" message so we
// don't leak which emails exist.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  generatePortalOtp,
  hashPortalOtp,
} from "@/lib/affiliate";
import { sendEmail } from "@/lib/email";
import { SHELL } from "@/lib/emails/layout";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const OTP_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SECURITY / FIXME (audit #12, #13 — rate limiting):
// This endpoint, /verify-otp, /api/lead-captures, /api/affiliate/signup,
// /api/checkout/pre-capture, and the Supabase signInWithPassword call in
// /login all currently have no per-IP rate limiting. Suggested defaults:
//   * request-otp:        10 / 15min / (email,ip)
//   * verify-otp:         10 / 15min / (email,ip)
//   * lead-captures:      30 /  1min / ip
//   * login:               5 /  5min / ip
//   * checkout pre-capture: 5 / 24h  / (page_id, buyer_email)
// Recommended implementation: Redis (already wired via ioredis) with a
// sliding-window counter. Deferred — limit choices are policy.

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Rate limit: 10 per 15min per (email, ip) — audit #12/#13.
  const ip = clientIp(request) ?? "unknown";
  const rl = await rateLimit(`otp:${email}:${ip}`, 10, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();

  // Only mail the OTP if this email actually appears on a link row.
  const { count } = await admin
    .from("affiliate_links")
    .select("id", { count: "exact", head: true })
    .eq("referrer_email", email);
  const exists = (count ?? 0) > 0;

  // Cool-down even when the email doesn't exist (drop spam silently).
  const { data: lastIssued } = await admin
    .from("affiliate_portal_otps")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastIssued?.created_at) {
    const ageMs = Date.now() - Date.parse(lastIssued.created_at);
    if (ageMs < COOLDOWN_MS) {
      // Still 200 — we don't want to leak that an OTP was recently sent.
      return NextResponse.json({
        ok: true,
        message: "If that email matches an affiliate, a code is on its way.",
      });
    }
  }

  if (exists) {
    const otp = generatePortalOtp(6);
    const otpHash = hashPortalOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    await admin.from("affiliate_portal_otps").insert({
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      ip_address: clientIp(request),
    });

    try {
      await sendEmail({
        to: email,
        role: "seller",
        subject: `Your InvoxAI affiliate code: ${otp}`,
        html: SHELL(
          `
          <h2 style="margin:0 0 12px;font-size:20px">Your portal login code</h2>
          <p style="margin:0 0 12px;line-height:1.5">Enter this code on the affiliate portal:</p>
          <p style="margin:0 0 12px;font-size:28px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace">${otp}</p>
          <p style="margin:0;color:#71717a;font-size:12px">Expires in 10 minutes. If you didn't ask for this, ignore the email.</p>
        `,
          { preheader: `Your affiliate login code is ${otp}.` },
        ),
      });
    } catch (e) {
      console.error("[affiliate-otp] email send failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email matches an affiliate, a code is on its way.",
    // Dev convenience — surface the OTP when Resend isn't set up.
    dev_otp:
      exists &&
      process.env.NODE_ENV !== "production" &&
      !process.env.RESEND_API_KEY
        ? "see logs"
        : undefined,
  });
}
