// GET /api/social-proof/[page_id]
//
// Returns the data the page's social-proof widgets need:
//   - events: last 10 anonymised events
//   - count: { total, today, week } counters
//
// Caching: Redis `sp_cache_<page_id>` with 30 s TTL — cuts the DB load
// to ~2 round-trips per minute per page regardless of traffic.
//
// Rate limit: 1 request per IP+page per 30 s. We honour it via a Redis
// SET NX EX. The cache and the rate-limit kick in independently, so a
// cached hit is fast even if the caller is rate-limited.
//
// RLS already allows public read on social_proof_events for published
// pages — see migration 001.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis";
import {
  SP_CACHE_TTL_SECONDS,
  SP_RL_TTL_SECONDS,
  spCacheKey,
  spCountKey,
  spRateLimitKey,
} from "@/lib/social-proof";

export const dynamic = "force-dynamic";

interface ProofRow {
  buyer_name: string | null;
  buyer_city: string | null;
  product_name: string | null;
  amount: number | null;
  is_seed: boolean | null;
  created_at: string;
}

interface ResponseBody {
  ok: true;
  events: ProofRow[];
  count: {
    total: number;
    today: number;
    week: number;
  };
  /** Cache age in seconds (0 = fresh). */
  age_s: number;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function GET(
  request: Request,
  { params }: { params: { page_id: string } },
) {
  const pageId = params.page_id;
  const redis = getRedis();
  const ip = clientIp(request);

  // ---- Rate limit ----------------------------------------------------------
  if (redis) {
    try {
      const set = await redis.set(
        spRateLimitKey(ip, pageId),
        "1",
        "EX",
        SP_RL_TTL_SECONDS,
        "NX",
      );
      if (set === null) {
        // Already set — caller is hitting us too fast. Still try to serve
        // them the cached payload (cheap), but with a 429 to discourage
        // tighter polls.
        const cached = await tryServeCached(redis, pageId, true);
        if (cached) return cached;
        return NextResponse.json(
          { ok: false, error: "Too many requests" },
          { status: 429 },
        );
      }
    } catch {
      /* non-fatal — proceed without limit */
    }
  }

  // ---- Cache ---------------------------------------------------------------
  if (redis) {
    const cached = await tryServeCached(redis, pageId, false);
    if (cached) return cached;
  }

  // ---- Fresh query ---------------------------------------------------------
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const weekStart = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("social_proof_events")
    .select("buyer_name, buyer_city, product_name, amount, is_seed, created_at")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, events: [] },
      { status: 500 },
    );
  }

  // Counters — prefer Redis for "total" (cheap, real-time), fall back to DB.
  let total = 0;
  if (redis) {
    const t = await redis.get(spCountKey(pageId)).catch(() => null);
    total = Number(t ?? 0);
  }
  if (total === 0) {
    const { count: totalDb } = await admin
      .from("social_proof_events")
      .select("id", { count: "exact", head: true })
      .eq("page_id", pageId);
    total = totalDb ?? 0;
    if (redis && total > 0) {
      try {
        await redis.set(spCountKey(pageId), String(total));
      } catch {
        /* non-fatal */
      }
    }
  }

  const [{ count: todayCount }, { count: weekCount }] = await Promise.all([
    admin
      .from("social_proof_events")
      .select("id", { count: "exact", head: true })
      .eq("page_id", pageId)
      .gte("created_at", todayIso),
    admin
      .from("social_proof_events")
      .select("id", { count: "exact", head: true })
      .eq("page_id", pageId)
      .gte("created_at", weekStart),
  ]);

  const body: ResponseBody = {
    ok: true,
    events: (data ?? []) as ProofRow[],
    count: {
      total,
      today: todayCount ?? 0,
      week: weekCount ?? 0,
    },
    age_s: 0,
  };

  // Persist into Redis cache. We stash the source timestamp alongside so the
  // cached path can report age_s honestly.
  if (redis) {
    try {
      await redis.set(
        spCacheKey(pageId),
        JSON.stringify({ ...body, _cached_at: nowIso }),
        "EX",
        SP_CACHE_TTL_SECONDS,
      );
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json(body);
}

async function tryServeCached(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  pageId: string,
  rateLimited: boolean,
): Promise<Response | null> {
  try {
    const raw = await redis.get(spCacheKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResponseBody & {
      _cached_at?: string;
    };
    const age_s = parsed._cached_at
      ? Math.max(
          0,
          Math.floor((Date.now() - Date.parse(parsed._cached_at)) / 1000),
        )
      : 0;
    return NextResponse.json(
      {
        ok: true,
        events: parsed.events,
        count: parsed.count,
        age_s,
      },
      {
        status: rateLimited ? 200 : 200,
        headers: {
          "x-cache": "HIT",
          ...(rateLimited ? { "x-rate-limited": "1" } : {}),
        },
      },
    );
  } catch {
    return null;
  }
}
