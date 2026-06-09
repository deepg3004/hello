// POST /api/builder/leads — a Lead Form widget submission. Public (visitors).
// Resolves the SITE OWNER's email server-side from siteId (never trusts a
// client-supplied address) and emails them the lead. Rate-limited to prevent
// abuse. (DB persistence in a builder_leads table is a later additive step.)

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { SHELL, escapeHtml } from "@/lib/emails/layout";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { siteId?: string; name?: string; email?: string; phone?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const siteId = (body.siteId ?? "").trim();
  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().slice(0, 200);
  const phone = (body.phone ?? "").trim().slice(0, 40);
  const message = (body.message ?? "").trim().slice(0, 4000);
  if (!siteId || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please fill in your name and a valid email." }, { status: 400 });
  }

  // Throttle per IP and per site so the form can't be used to spam the owner.
  const ipRl = await rateLimit(`builder-lead-ip:${clientIp(request)}`, 20, 60 * 60);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);
  const siteRl = await rateLimit(`builder-lead:${siteId}`, 100, 60 * 60);
  if (!siteRl.ok) return tooManyRequests(siteRl.retryAfter);

  const admin = createAdminClient();
  const { data: site } = await admin
    .from("builder_sites")
    .select("user_id, title")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const { data: owner } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", site.user_id)
    .maybeSingle();
  if (!owner?.email) return NextResponse.json({ error: "Owner unreachable" }, { status: 404 });

  // Persist the lead (best-effort — emailing is the primary delivery; the
  // dashboard Leads viewer reads this table).
  try {
    await admin.from("builder_leads").insert({
      site_id: siteId,
      user_id: site.user_id,
      name,
      email,
      phone: phone || null,
      message: message || null,
    });
  } catch (e) {
    console.error("[builder/leads] persist failed", e);
  }

  await sendEmail({
    to: owner.email,
    role: "noreply",
    reply_to: email,
    sellerId: site.user_id,
    subject: `New lead from ${name}${site.title ? ` — ${site.title}` : ""}`,
    html: SHELL(
      `<h2 style="margin:0 0 12px;font-size:20px">New lead 📩</h2>
       <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
       <strong>Email:</strong> ${escapeHtml(email)}${phone ? `<br/><strong>Phone:</strong> ${escapeHtml(phone)}` : ""}</p>
       ${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}`,
      { preheader: `New lead from ${name}` },
    ),
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
