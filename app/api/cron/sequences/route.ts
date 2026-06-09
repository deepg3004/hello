// POST or GET /api/cron/sequences — drip scheduler. Sends every due sequence
// step and advances each enrollment. Auth: x-cron-secret: $CRON_SECRET.
//
// Wire from VPS system cron (run every ~15 min):
//   */15 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
//                https://app.invoxai.io/api/cron/sequences

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { processDueEnrollments } from "@/lib/sequences";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await processDueEnrollments(createAdminClient());
  return NextResponse.json({ ok: true, ...res });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
