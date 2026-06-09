// POST /api/affiliate/signup
//
// Body: { page_id, name, email, phone?, pitch? }
//
// Creates an affiliate_links row for the (page, email) pair (idempotent —
// returning the existing row if the same email signs up twice). Emails the
// affiliate their unique referral link so they can start sharing.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { mintReferralCode } from "@/lib/affiliate";
import { sendEmail } from "@/lib/emails/send";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

export async function POST(request: Request) {
  let body: {
    page_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    pitch?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const page_id = body.page_id?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim();
  const pitch = body.pitch?.trim();

  if (!page_id || !name || name.length < 2 || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "page_id + name + valid email required" },
      { status: 400 },
    );
  }

  // Unauthenticated + sends two emails per call → throttle per IP and per
  // (page, email) to prevent email-bombing / affiliate-row spam.
  const ipRl = await rateLimit(`affsignup-ip:${clientIp(request)}`, 20, 60 * 60);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);
  const pairRl = await rateLimit(`affsignup:${page_id}:${email}`, 3, 24 * 60 * 60);
  if (!pairRl.ok) return tooManyRequests(pairRl.retryAfter);

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, slug, title, status, user_id")
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Page not live" }, { status: 404 });
  }

  const { data: program } = await admin
    .from("affiliates")
    .select("id, status")
    .eq("page_id", page_id)
    .single();
  if (!program || program.status !== "active") {
    return NextResponse.json(
      { error: "Affiliate program isn't active" },
      { status: 404 },
    );
  }

  // Idempotent: same email signing up again gets their existing link.
  const { data: existing } = await admin
    .from("affiliate_links")
    .select("id, referral_code")
    .eq("affiliate_id", program.id)
    .eq("referrer_email", email)
    .maybeSingle();

  let referralCode: string;
  if (existing) {
    referralCode = existing.referral_code;
  } else {
    referralCode = mintReferralCode();
    const { error } = await admin.from("affiliate_links").insert({
      affiliate_id: program.id,
      referrer_name: name,
      referrer_email: email,
      referrer_phone: phone ?? null,
      referrer_pitch: pitch ?? null,
      referral_code: referralCode,
      last_active_at: new Date().toISOString(),
    });
    if (error) {
      // Unique-violation race: another tab won — fetch and return their code.
      const { data: dup } = await admin
        .from("affiliate_links")
        .select("referral_code")
        .eq("affiliate_id", program.id)
        .eq("referrer_email", email)
        .single();
      if (dup) {
        referralCode = dup.referral_code;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  const referralUrl = `${APP_URL}/p/${page.slug}?ref=${referralCode}`;

  // Notify the affiliate with their referral link. Best-effort.
  try {
    await sendEmail(
      "welcome",
      email,
      { seller_name: name },
      { tags: [{ name: "type", value: "affiliate_signup" }] },
    );
    // Send a tiny note with their referral link via the payment-failed-
    // shaped lookup is overkill — instead embed in their portal copy. We
    // reuse the welcome template above and follow up with a plain Resend
    // call below for the referral link itself.
    const { sendEmail: sendRaw } = await import("@/lib/email");
    await sendRaw({
      to: email,
      subject: `Your affiliate link for ${page.title}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b;padding:16px">
        <h2 style="margin:0 0 12px;font-size:18px">You're in 🎉</h2>
        <p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px">Share this link to earn on every sale of <strong>${escapeHtml(page.title)}</strong>:</p>
        <p style="margin:0 0 12px"><a href="${referralUrl}" style="color:#0a0a0a;text-decoration:underline">${referralUrl}</a></p>
        <p style="margin:0;color:#71717a;font-size:12px">Manage your earnings any time — your portal lives at ${APP_URL}/affiliate/portal.</p>
      </div>`,
    });
  } catch (e) {
    console.error("[affiliate-signup] email send failed", e);
  }

  return NextResponse.json({
    ok: true,
    referral_code: referralCode,
    referral_url: referralUrl,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
