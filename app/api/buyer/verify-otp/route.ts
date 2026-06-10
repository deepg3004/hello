// POST /api/buyer/verify-otp
//
// Body: { email, otp }
//
// Validates the OTP against the most-recent unused row, marks it used, and sets
// the buyer session cookie that /account reads.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUYER_COOKIE,
  BUYER_COOKIE_TTL_DAYS,
  hashBuyerOtp,
  signBuyerSession,
} from "@/lib/buyer-portal";
import { recordBuyerLogin } from "@/lib/buyers";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  let body: { email?: string; otp?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  const otp = body.otp?.trim();
  if (!email || !otp || !/^\d{4,8}$/.test(otp)) {
    return NextResponse.json(
      { error: "email + numeric otp required" },
      { status: 400 },
    );
  }

  // Rate-limit verify attempts per email+IP so the per-row attempt counter
  // can't be reset by re-requesting codes to brute-force the OTP space.
  const rl = await rateLimit(`buyer-verify:${email}:${clientIp(request)}`, 10, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("buyer_portal_otps")
    .select("id, otp_hash, expires_at, attempts, used_at")
    .eq("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Request a new code." }, { status: 400 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Code expired." }, { status: 400 });
  }
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }
  if (hashBuyerOtp(otp) !== row.otp_hash) {
    await admin
      .from("buyer_portal_otps")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id);
    return NextResponse.json({ error: "Code didn't match." }, { status: 400 });
  }

  await admin
    .from("buyer_portal_otps")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  // Record the buyer account + login event (best-effort, never blocks login).
  await recordBuyerLogin(
    {
      email,
      provider: "email_otp",
      emailVerified: true,
      host: request.headers.get("host"),
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    },
    admin,
  );

  const token = signBuyerSession(email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: BUYER_COOKIE,
    value: token,
    maxAge: BUYER_COOKIE_TTL_DAYS * 86_400,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
