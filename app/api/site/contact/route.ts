// POST /api/site/contact — a website contact-form submission emails the seller.
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { extractSubdomain } from "@/lib/domains";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/emails/layout";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let body: { host?: string; name?: string; email?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const host = (body.host ?? "").toLowerCase().split(":")[0] ?? "";
  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().slice(0, 200);
  const message = (body.message ?? "").trim().slice(0, 5000);
  if (!host || !name || !email || !message) {
    return NextResponse.json({ error: "Please fill in all fields." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  // Unauthenticated → emails the seller per call. Throttle per IP and per host
  // so the contact form can't be used as a spam amplifier.
  const ipRl = await rateLimit(`sitecontact-ip:${clientIp(request)}`, 15, 60 * 60);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);
  const hostRl = await rateLimit(`sitecontact:${host}`, 30, 60 * 60);
  if (!hostRl.ok) return tooManyRequests(hostRl.retryAfter);

  const admin = createAdminClient();
  const sub = extractSubdomain(host);
  const q = admin.from("user_profiles").select("id, email, full_name");
  const { data: seller } = await (sub
    ? q.eq("subdomain", sub)
    : q.eq("custom_domain", host)
  ).maybeSingle();

  if (!seller?.email) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  await sendEmail({
    to: seller.email,
    role: "noreply",
    reply_to: email,
    sellerId: seller.id,
    subject: `New website message from ${name}`,
    html: `
      <p>You received a new message from your website contact form:</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
      <strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    `,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
