"use server";

import { revalidatePath } from "next/cache";

import { requireActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis";
import {
  computeExperimentStats,
  conversionsKey,
  expConfigKey,
  revenueKey,
  visitorsKey,
  type Variant,
} from "@/lib/ab";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

interface Ok {
  ok: true;
  message?: string;
}
interface Err {
  ok: false;
  message: string;
}
type Result = Ok | Err;

async function loadPageForOwner(pageId: string): Promise<
  | {
      ok: true;
      page: {
        id: string;
        slug: string;
        user_id: string;
        page_config: Record<string, unknown> | null;
        variant_b_config: Record<string, unknown> | null;
        experiment_status: string | null;
        traffic_split: number | null;
        success_metric: string | null;
        type: string;
      };
      uid: string;
    }
  | Err
> {
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, slug, user_id, page_config, variant_b_config, experiment_status, traffic_split, success_metric, type",
    )
    .eq("id", pageId)
    .single();
  if (!page) return { ok: false, message: "Page not found" };
  if (page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Not your page" };
  }
  return { ok: true, page, uid: ctx.ownerId };
}

async function resetCounters(slug: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(
      visitorsKey(slug, "A"),
      visitorsKey(slug, "B"),
      conversionsKey(slug, "A"),
      conversionsKey(slug, "B"),
      revenueKey(slug, "A"),
      revenueKey(slug, "B"),
      expConfigKey(slug),
    );
  } catch (e) {
    console.error("[ab] reset counters failed", e);
  }
}

async function snapshotCurrentStats(args: {
  pageId: string;
  slug: string;
  type: string;
  successMetric: string | null;
}): Promise<{
  visitors_a: number;
  visitors_b: number;
  conversions_a: number;
  conversions_b: number;
  revenue_a: number;
  revenue_b: number;
  confidence: number;
  winner: Variant | null;
}> {
  const admin = createAdminClient();
  const redis = getRedis();
  let visitorsA = 0;
  let visitorsB = 0;
  if (redis) {
    const [va, vb] = await Promise.all([
      redis.get(visitorsKey(args.slug, "A")),
      redis.get(visitorsKey(args.slug, "B")),
    ]);
    visitorsA = Number(va ?? 0);
    visitorsB = Number(vb ?? 0);
  }

  let conversionsA = 0;
  let conversionsB = 0;
  let revenueA = 0;
  let revenueB = 0;

  if (args.successMetric === "form_submission" || args.type === "landing") {
    const { data: leadRows } = await admin
      .from("lead_captures")
      .select("exp_variant")
      .eq("page_id", args.pageId)
      .not("exp_variant", "is", null);
    for (const r of leadRows ?? []) {
      if (r.exp_variant === "A") conversionsA += 1;
      else if (r.exp_variant === "B") conversionsB += 1;
    }
  } else {
    const { data: orderRows } = await admin
      .from("orders")
      .select("exp_variant, amount")
      .eq("page_id", args.pageId)
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

  const stats = computeExperimentStats({
    visitors_a: visitorsA,
    visitors_b: visitorsB,
    conversions_a: conversionsA,
    conversions_b: conversionsB,
  });

  return {
    visitors_a: visitorsA,
    visitors_b: visitorsB,
    conversions_a: conversionsA,
    conversions_b: conversionsB,
    revenue_a: Math.round(revenueA * 100) / 100,
    revenue_b: Math.round(revenueB * 100) / 100,
    confidence: stats.confidence,
    winner: stats.winner,
  };
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export async function startExperimentAction(input: {
  page_id: string;
  variant_b_config: Record<string, unknown>;
  traffic_split: number;
  success_metric: "payment_conversion" | "form_submission";
}): Promise<Result> {
  const loaded = await loadPageForOwner(input.page_id);
  if (!loaded.ok) return loaded;
  const { page } = loaded;

  if (page.experiment_status === "running") {
    return { ok: false, message: "Experiment already running. Stop it first." };
  }
  const ts = Number(input.traffic_split);
  if (!Number.isFinite(ts) || ts < 10 || ts > 90) {
    return { ok: false, message: "Traffic split must be between 10 and 90." };
  }
  if (
    input.success_metric !== "payment_conversion" &&
    input.success_metric !== "form_submission"
  ) {
    return { ok: false, message: "Unknown success metric." };
  }
  if (
    !input.variant_b_config ||
    typeof input.variant_b_config !== "object"
  ) {
    return { ok: false, message: "Variant B config missing." };
  }

  // Reset counters from any previous experiment with this slug.
  await resetCounters(page.slug);

  const admin = createAdminClient();
  const { error } = await admin
    .from("pages")
    .update({
      experiment_status: "running",
      variant_b_config: input.variant_b_config,
      traffic_split: ts,
      success_metric: input.success_metric,
      experiment_started_at: new Date().toISOString(),
      experiment_ended_at: null,
    })
    .eq("id", page.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/pages/${page.id}/ab-test`);
  revalidatePath(`/p/${page.slug}`);
  return { ok: true };
}

export async function stopExperimentAction(
  pageId: string,
): Promise<Result> {
  const loaded = await loadPageForOwner(pageId);
  if (!loaded.ok) return loaded;
  const { page } = loaded;
  if (page.experiment_status !== "running") {
    return { ok: false, message: "No experiment running." };
  }

  const snap = await snapshotCurrentStats({
    pageId: page.id,
    slug: page.slug,
    type: page.type,
    successMetric: page.success_metric,
  });

  const admin = createAdminClient();
  const endedAt = new Date().toISOString();

  // Archive into page_experiments — keeps the running A as-is, drops B.
  await admin.from("page_experiments").insert({
    page_id: page.id,
    seller_user_id: loaded.uid,
    started_at:
      (page as unknown as { experiment_started_at?: string })
        .experiment_started_at ?? endedAt,
    ended_at: endedAt,
    success_metric: page.success_metric ?? "payment_conversion",
    traffic_split: Number(page.traffic_split ?? 50),
    variant_a_config: page.page_config ?? null,
    variant_b_config: page.variant_b_config ?? null,
    visitors_a: snap.visitors_a,
    visitors_b: snap.visitors_b,
    conversions_a: snap.conversions_a,
    conversions_b: snap.conversions_b,
    revenue_a: snap.revenue_a,
    revenue_b: snap.revenue_b,
    confidence: snap.confidence,
    winner: snap.winner ?? "inconclusive",
    outcome: "stopped",
  });

  const { error } = await admin
    .from("pages")
    .update({
      experiment_status: "completed",
      variant_b_config: null,
      experiment_ended_at: endedAt,
    })
    .eq("id", page.id);
  if (error) return { ok: false, message: error.message };

  await resetCounters(page.slug);

  revalidatePath(`/dashboard/pages/${page.id}/ab-test`);
  revalidatePath(`/p/${page.slug}`);
  return { ok: true };
}

export async function promoteWinnerAction(input: {
  page_id: string;
  winner: Variant;
}): Promise<Result> {
  const loaded = await loadPageForOwner(input.page_id);
  if (!loaded.ok) return loaded;
  const { page } = loaded;
  if (page.experiment_status !== "running") {
    return { ok: false, message: "No experiment running." };
  }
  if (input.winner !== "A" && input.winner !== "B") {
    return { ok: false, message: "Pick A or B." };
  }

  const snap = await snapshotCurrentStats({
    pageId: page.id,
    slug: page.slug,
    type: page.type,
    successMetric: page.success_metric,
  });

  const admin = createAdminClient();
  const endedAt = new Date().toISOString();

  await admin.from("page_experiments").insert({
    page_id: page.id,
    seller_user_id: loaded.uid,
    started_at:
      (page as unknown as { experiment_started_at?: string })
        .experiment_started_at ?? endedAt,
    ended_at: endedAt,
    success_metric: page.success_metric ?? "payment_conversion",
    traffic_split: Number(page.traffic_split ?? 50),
    variant_a_config: page.page_config ?? null,
    variant_b_config: page.variant_b_config ?? null,
    visitors_a: snap.visitors_a,
    visitors_b: snap.visitors_b,
    conversions_a: snap.conversions_a,
    conversions_b: snap.conversions_b,
    revenue_a: snap.revenue_a,
    revenue_b: snap.revenue_b,
    confidence: snap.confidence,
    winner: input.winner,
    outcome: "promoted",
  });

  // If B wins, copy its config into page_config.
  const updates: Record<string, unknown> = {
    experiment_status: "completed",
    variant_b_config: null,
    experiment_ended_at: endedAt,
  };
  if (input.winner === "B" && page.variant_b_config) {
    updates.page_config = page.variant_b_config;
  }

  const { error } = await admin
    .from("pages")
    .update(updates)
    .eq("id", page.id);
  if (error) return { ok: false, message: error.message };

  await resetCounters(page.slug);

  revalidatePath(`/dashboard/pages/${page.id}/ab-test`);
  revalidatePath(`/dashboard/pages/${page.id}/edit`);
  revalidatePath(`/p/${page.slug}`);
  return { ok: true };
}
