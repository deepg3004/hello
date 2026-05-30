// GET /api/ab/config?slug=<page_slug>
//
// Called from middleware (Edge runtime) so it has to be fast + cacheable.
// Returns the minimum routing info needed to decide a variant:
//   { running, traffic_split, has_variant_b }
//
// Caching strategy:
//   - 60-second `next: { revalidate }` so subsequent middleware hits dodge
//     the round-trip
//   - The Redis path is intentionally NOT exercised here — middleware can't
//     use ioredis, and we don't want to spin up a separate REST endpoint to
//     wrap Redis. The DB hit is cheap (~1 row lookup with an index).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Cache the response itself so repeated middleware hits within the window
// reuse the JSON without re-hitting the function. The seller's "Start
// experiment" action invalidates this via revalidatePath.
export const revalidate = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select(
      "experiment_status, traffic_split, variant_b_config, success_metric",
    )
    .eq("slug", slug)
    .single();

  if (!data || data.experiment_status !== "running") {
    return NextResponse.json(
      {
        ok: true,
        running: false,
        traffic_split: null,
        has_variant_b: false,
      },
      { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      running: true,
      traffic_split: Number(data.traffic_split ?? 50),
      has_variant_b: !!data.variant_b_config,
      success_metric: data.success_metric ?? null,
    },
    { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
  );
}
