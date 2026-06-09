// POST /api/checkout/pre-capture
//
// Body: { page_id, buyer_email, buyer_name?, buyer_phone?, amount? }
//
// Fires on the email-field blur in CheckoutForm — long before the buyer
// ever hits "Pay". Upserts an abandoned_checkouts row (status='active') and
// schedules the 4-step BullMQ recovery sequence. Idempotent: if a row for
// (page_id, buyer_email, status='active') already exists, we refresh it and
// we leave the existing recovery jobs in place.
//
// Response is intentionally minimal — the client treats this call as
// background telemetry.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleRecovery } from "@/lib/queues/recovery";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  let body: {
    page_id?: string;
    buyer_email?: string;
    buyer_name?: string;
    buyer_phone?: string;
    amount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const {
    page_id,
    buyer_email,
    buyer_name,
    buyer_phone,
    amount: amountIn,
  } = body;
  if (!page_id || !buyer_email || !EMAIL_RE.test(buyer_email)) {
    return NextResponse.json(
      { error: "page_id + valid buyer_email are required" },
      { status: 400 },
    );
  }

  // This unauthenticated endpoint inserts a DB row + schedules a 4-step email
  // sequence to buyer_email, so throttle per IP and per (page, email) to stop
  // an attacker spamming victim inboxes / bloating the recovery queue.
  const ipRl = await rateLimit(`precapture-ip:${clientIp(request)}`, 30, 60 * 60);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);
  const pairRl = await rateLimit(
    `precapture:${page_id}:${buyer_email.toLowerCase()}`,
    5,
    24 * 60 * 60,
  );
  if (!pairRl.ok) return tooManyRequests(pairRl.retryAfter);

  const admin = createAdminClient();

  // Resolve the page → seller + default product (for the recovery hero).
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, status")
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Page not live" }, { status: 404 });
  }
  const { data: product } = await admin
    .from("products")
    .select("id, price")
    .eq("page_id", page_id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const amount = Number(
    amountIn ?? product?.price ?? 0,
  );

  // Find existing active row.
  const { data: existing } = await admin
    .from("abandoned_checkouts")
    .select("id, recovery_token, recovery_job_ids")
    .eq("page_id", page_id)
    .ilike("buyer_email", buyer_email)
    .eq("status", "active")
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existing) {
    // Idempotent refresh — only update soft fields and last_seen_at.
    await admin
      .from("abandoned_checkouts")
      .update({
        buyer_name: buyer_name ?? null,
        buyer_phone: buyer_phone ?? null,
        amount: amount > 0 ? amount : null,
        product_id: product?.id ?? null,
        last_seen_at: nowIso,
      })
      .eq("id", existing.id);
    return NextResponse.json({
      ok: true,
      abandoned_id: existing.id,
      recovery_token: existing.recovery_token,
      refreshed: true,
    });
  }

  // Create fresh row.
  const recoveryToken = nanoid(32);
  const tokenExpires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { data: inserted, error: insertErr } = await admin
    .from("abandoned_checkouts")
    .insert({
      page_id,
      seller_user_id: page.user_id,
      buyer_email,
      buyer_name: buyer_name ?? null,
      buyer_phone: buyer_phone ?? null,
      amount: amount > 0 ? amount : null,
      product_id: product?.id ?? null,
      status: "active",
      recovery_token: recoveryToken,
      token_expires_at: tokenExpires,
      step_reached: "pre_capture",
      last_seen_at: nowIso,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  // Schedule the recovery sequence.
  try {
    const jobIds = await scheduleRecovery(inserted.id);
    if (jobIds) {
      await admin
        .from("abandoned_checkouts")
        .update({ recovery_job_ids: jobIds })
        .eq("id", inserted.id);
    }
  } catch (e) {
    console.error("[pre-capture] scheduleRecovery failed", e);
    // Non-fatal — we still saved the row, the seller's CRM gets the lead.
  }

  return NextResponse.json({
    ok: true,
    abandoned_id: inserted.id,
    recovery_token: recoveryToken,
    refreshed: false,
  });
}
