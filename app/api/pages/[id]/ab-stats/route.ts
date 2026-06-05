// GET /api/pages/[id]/ab-stats
//
// Returns per-variant visitors / conversions / conversion-rate / revenue
// together with the two-proportion z-test confidence + winner gating.
//
// Counters come from Redis when available (fast, real-time) with a
// Postgres fallback that counts paid orders / lead captures bucketed by
// exp_variant. The fallback path is what protects us if Redis is wiped.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";
import { getRedis } from "@/lib/redis";
import {
  CONFIDENCE_THRESHOLD,
  MIN_PER_ARM,
  computeExperimentStats,
  conversionsKey,
  revenueKey,
  visitorsKey,
  type Variant,
} from "@/lib/ab";

interface VariantSnapshot {
  variant: Variant;
  visitors: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getActorContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, slug, user_id, experiment_status, traffic_split, success_metric, experiment_started_at, type",
    )
    .eq("id", params.id)
    .single();
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  const { data: caller } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", ctx.authUserId)
    .single();
  const isOwner = page.user_id === ctx.ownerId && ctx.can("pages.view");
  const isAdmin = !!caller?.is_admin;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const redis = getRedis();

  // ---- Visitors (Redis only; we never wrote them to Postgres) ----
  let visitorsA = 0;
  let visitorsB = 0;
  if (redis && page.slug) {
    const [va, vb] = await Promise.all([
      redis.get(visitorsKey(page.slug, "A")),
      redis.get(visitorsKey(page.slug, "B")),
    ]);
    visitorsA = Number(va ?? 0);
    visitorsB = Number(vb ?? 0);
  }

  // ---- Conversions + revenue ----
  let conversionsA = 0;
  let conversionsB = 0;
  let revenueA = 0;
  let revenueB = 0;

  // Prefer DB truth (covers webhook + post-payment recovery cases).
  if (page.success_metric === "form_submission" || page.type === "landing") {
    const { data: leadRows } = await admin
      .from("lead_captures")
      .select("exp_variant")
      .eq("page_id", page.id)
      .not("exp_variant", "is", null);
    for (const r of leadRows ?? []) {
      if (r.exp_variant === "A") conversionsA += 1;
      else if (r.exp_variant === "B") conversionsB += 1;
    }
  } else {
    const { data: orderRows } = await admin
      .from("orders")
      .select("exp_variant, amount")
      .eq("page_id", page.id)
      .eq("status", "paid")
      .not("exp_variant", "is", null);
    for (const r of orderRows ?? []) {
      const amt = Number(r.amount ?? 0);
      if (r.exp_variant === "A") {
        conversionsA += 1;
        revenueA += amt;
      } else if (r.exp_variant === "B") {
        conversionsB += 1;
        revenueB += amt;
      }
    }
  }

  // If Redis has higher conversion counters (e.g. async writes), use them.
  if (redis && page.slug) {
    const [ca, cb, ra, rb] = await Promise.all([
      redis.get(conversionsKey(page.slug, "A")),
      redis.get(conversionsKey(page.slug, "B")),
      redis.get(revenueKey(page.slug, "A")),
      redis.get(revenueKey(page.slug, "B")),
    ]);
    conversionsA = Math.max(conversionsA, Number(ca ?? 0));
    conversionsB = Math.max(conversionsB, Number(cb ?? 0));
    revenueA = Math.max(revenueA, Number(ra ?? 0) / 100);
    revenueB = Math.max(revenueB, Number(rb ?? 0) / 100);
  }

  const stats = computeExperimentStats({
    visitors_a: visitorsA,
    visitors_b: visitorsB,
    conversions_a: conversionsA,
    conversions_b: conversionsB,
  });

  const snapshots: VariantSnapshot[] = [
    {
      variant: "A",
      visitors: visitorsA,
      conversions: conversionsA,
      conversion_rate: stats.cr_a,
      revenue: revenueA,
    },
    {
      variant: "B",
      visitors: visitorsB,
      conversions: conversionsB,
      conversion_rate: stats.cr_b,
      revenue: revenueB,
    },
  ];

  return NextResponse.json({
    ok: true,
    experiment_status: page.experiment_status,
    traffic_split: page.traffic_split ? Number(page.traffic_split) : null,
    success_metric: page.success_metric,
    started_at: page.experiment_started_at,
    snapshots,
    z: stats.z,
    confidence: stats.confidence,
    winner: stats.winner,
    significant: stats.significant,
    thresholds: {
      min_per_arm: MIN_PER_ARM,
      confidence: CONFIDENCE_THRESHOLD,
    },
  });
}
