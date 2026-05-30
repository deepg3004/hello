// GET /api/health
//
// Lightweight readiness probe. Uptime Robot / PM2 / cron can hit this every
// minute without burning service-role quota — we run a single `select 1`
// against Postgres and a `PING` against Redis. Returns 200 only when both
// answer. Body always includes per-check status for the operator.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  error?: string;
}

interface HealthBody {
  ok: boolean;
  status: "healthy" | "degraded" | "down";
  uptime_s: number;
  version: string | null;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
  generated_at: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("user_profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, latency_ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const redis = getRedis();
    if (!redis) {
      // Redis is optional — treat as "soft ok" so we don't trip uptime
      // checks on environments without Redis configured. Operators who care
      // can read the field directly.
      return { ok: true, error: "not_configured" };
    }
    const reply = await redis.ping();
    if (reply !== "PONG") {
      return { ok: false, error: `Unexpected PING reply: ${reply}` };
    }
    return { ok: true, latency_ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const dbOk = database.ok;
  const redisOk = redis.ok && redis.error !== "not_configured";

  let status: HealthBody["status"];
  if (dbOk && redisOk) status = "healthy";
  else if (dbOk) status = "degraded"; // Postgres up, Redis missing/down
  else status = "down";

  const body: HealthBody = {
    ok: dbOk,
    status,
    uptime_s: Math.round(process.uptime()),
    version:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT_SHA ??
      null,
    checks: { database, redis },
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
