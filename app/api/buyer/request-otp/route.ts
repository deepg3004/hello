// POST /api/buyer/request-otp
//
// Body: { email }
//
// Mails a 6-digit code to a buyer's email so they can open /account. We only
// actually send when the email has at least one PAID order; everyone else gets
// the same "if that email has purchases, a code is on its way" reply so we
// don't leak which emails exist.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateBuyerOtp, hashBuyerOtp } from "@/lib/buyer-portal";
import { sendEmail } from "@/lib/email";
import { SHELL } from "@/lib/emails/layout";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const OTP_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // 10 per 15min per (email, ip).
  const ip = clientIp(request) ?? "unknown";
  const rl = await rateLimit(`buyer-otp:${email}:${ip}`, 10, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();

  // Only mail if this email has at least one paid order.
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_email", email)
    .eq("status", "paid");
  const exists = (count ?? 0) > 0;

  // Cool-down regardless of existence (drop spam silently).
  const { data: lastIssued } = await admin
    .from("buyer_portal_otps")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastIssued?.created_at) {
    const ageMs = Date.now() - Date.parse(lastIssued.created_at);
    if (ageMs < COOLDOWN_MS) {
      return NextResponse.json({
        ok: true,
        message: "If that email has purchases, a code is on its way.",
      });
    }
  }

  if (exists) {
    const otp = generateBuyerOtp(6);
    const otpHash = hashBuyerOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    await admin.from("buyer_portal_otps").insert({
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      ip_address: clientIp(request),
    });

    try {
      await sendEmail({
        to: email,
        role: "buyer",
        subject: `Your InvoxAI login code: ${otp}`,
        html: SHELL(
          `
          <h2 style="margin:0 0 12px;font-size:20px">Your account login code</h2>
          <p style="margin:0 0 12px;line-height:1.5">Enter this code to view your purchases:</p>
          <p style="margin:0 0 12px;font-size:28px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace">${otp}</p>
          <p style="margin:0;color:#71717a;font-size:12px">Expires in 10 minutes. If you didn't ask for this, ignore the email.</p>
        `,
          { preheader: `Your account login code is ${otp}.` },
        ),
      });
    } catch (e) {
      console.error("[buyer-otp] email send failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has purchases, a code is on its way.",
  });
}
