// POST/GET /api/cron/payout-dispatch
//
// Picks up payouts where status='pending' and scheduled_at < NOW(), dispatches
// each one through processPayoutJob(), returns counts. Run every 1–5 minutes
// on the VPS:
//
//   * * * * * curl -X POST -H "x-cron-secret: …" https://app.invoxai.io/api/cron/payout-dispatch
//
// Gated by CRON_SECRET.

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { processPayoutJob } from "@/lib/payouts";

function authed(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: ready } = await admin
    .from("payouts")
    .select("id")
    .eq("status", "pending")
    .lt("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  const ids = (ready ?? []).map((r) => r.id as string);
  let dispatched = 0;
  let failed = 0;

  for (const id of ids) {
    const result = await processPayoutJob(id);
    if (result.ok) dispatched++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    looked_at: ids.length,
    dispatched,
    failed,
  });
}

export const GET = run;
export const POST = run;
