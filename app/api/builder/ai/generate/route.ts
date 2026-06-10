// POST /api/builder/ai/generate  { businessType, businessName, goal?, audience?, style?, colors? }
//
// Generates a landing page with Claude, sanitises it into a builder document,
// creates it as a NEW page on the seller's site, logs the generation (for the
// monthly quota + admin visibility), and returns its id so the client opens it
// in the editor. Owner-scoped. Mirrors the persistence in sites/apply.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { documentFromAiSite } from "@/lib/builder/ai-map";
import { generateSite, aiGeneratorEnabled, type SiteBrief } from "@/lib/ai/generate-site";
import type { PlanKey } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // model calls can take a while

// Per-plan monthly AI generation allowance. Kept here (not in PLANS) so it can
// be tuned without touching the pricing source of truth.
const MONTHLY_LIMIT: Record<PlanKey, number> = {
  free: 3,
  starter: 15,
  pro: 60,
  business: 200,
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "page";
}

export async function POST(request: Request) {
  if (!(await aiGeneratorEnabled())) {
    return NextResponse.json({ error: "AI generation isn't available yet." }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<SiteBrief>;
  try {
    body = (await request.json()) as Partial<SiteBrief>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const businessType = (body.businessType ?? "").trim();
  const businessName = (body.businessName ?? "").trim();
  if (!businessType || !businessName) {
    return NextResponse.json(
      { error: "Tell us your business type and name to generate a page." },
      { status: 400 },
    );
  }
  const brief: SiteBrief = {
    businessType: businessType.slice(0, 120),
    businessName: businessName.slice(0, 120),
    goal: body.goal?.trim().slice(0, 200),
    audience: body.audience?.trim().slice(0, 200),
    style: body.style?.trim().slice(0, 120),
    colors: body.colors?.trim().slice(0, 80),
  };

  const admin = createAdminClient();

  // ── Monthly quota gate ─────────────────────────────────────────────────────
  const { data: prof } = await admin
    .from("user_profiles")
    .select("subscription_plan, subdomain")
    .eq("id", user.id)
    .maybeSingle();
  const plan = (prof?.subscription_plan ?? "free") as PlanKey;
  const limit = MONTHLY_LIMIT[plan] ?? MONTHLY_LIMIT.free;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: used } = await admin
    .from("builder_ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "success")
    .gte("created_at", monthStart.toISOString());
  if ((used ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `You've used all ${limit} AI generations on your plan this month. Upgrade for more.`,
        limitReached: true,
      },
      { status: 429 },
    );
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  const result = await generateSite(brief);
  if (!result.ok || !result.site) {
    await admin.from("builder_ai_generations").insert({
      user_id: user.id,
      brief_json: brief,
      status: "failed",
      error: result.error ?? "unknown",
      model: "claude-opus-4-8",
    });
    return NextResponse.json({ error: result.error ?? "Generation failed." }, { status: 502 });
  }

  const document = documentFromAiSite(result.site);

  // ── Persist as a new page (find or create the seller's site) ───────────────
  let { data: site } = await admin
    .from("builder_sites")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!site) {
    let slug = (prof?.subdomain as string | null) || `u-${user.id.slice(0, 8)}`;
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await admin
        .from("builder_sites")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const { data: created, error } = await admin
      .from("builder_sites")
      .insert({ user_id: user.id, slug, title: result.site.title?.slice(0, 120) || "My site" })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    site = created;
  }

  const name = (result.site.title || brief.businessName).slice(0, 120);
  const path = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: page, error: pErr } = await admin
    .from("builder_pages")
    .insert({
      site_id: site.id,
      user_id: user.id,
      name,
      path,
      page_type: "landing",
      content_json: document,
      background_style: "gradient",
    })
    .select("id")
    .single();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  await admin.from("builder_ai_generations").insert({
    user_id: user.id,
    brief_json: brief,
    output_json: result.site,
    page_id: page.id,
    status: "success",
    model: "claude-opus-4-8",
    input_tokens: result.inputTokens ?? null,
    output_tokens: result.outputTokens ?? null,
  });

  return NextResponse.json({ ok: true, pageId: page.id, remaining: limit - (used ?? 0) - 1 });
}
