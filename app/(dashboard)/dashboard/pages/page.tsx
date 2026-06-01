import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, FileText, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CreatePageTile,
  PageCard,
  type PageCardData,
} from "@/components/dashboard/PageCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/plans";

export const metadata = { title: "Pages" };

export default async function PagesListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: pagesRaw }, { data: profile }] = await Promise.all([
    admin
      .from("pages")
      .select(
        "id, title, slug, type, status, template_id, thumbnail_url, view_count, conversion_count, total_revenue, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("user_profiles")
      .select("subscription_plan, subscription_status")
      .eq("id", user.id)
      .single(),
  ]);

  const pages: PageCardData[] = (pagesRaw ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    type: p.type as PageCardData["type"],
    status: p.status as PageCardData["status"],
    template_id: p.template_id ?? "course",
    thumbnail_url: p.thumbnail_url,
    view_count: Number(p.view_count ?? 0),
    conversion_count: Number(p.conversion_count ?? 0),
    total_revenue: Number(p.total_revenue ?? 0),
    created_at: p.created_at,
  }));

  // Plan + limit
  const planKey = (profile?.subscription_plan ?? "free") as PlanKey;
  const effective: PlanKey =
    planKey === "free" ||
    ["active", "trialing"].includes(profile?.subscription_status ?? "")
      ? planKey
      : "free";
  const planEntry = PLANS[effective in PLANS ? effective : "free"];
  const limit = planEntry.pages;
  const atLimit = limit !== -1 && pages.length >= limit;

  return (
    <div className="space-y-6">
      {/* ── Header row ───────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 animate-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="font-sora text-2xl font-semibold tracking-tight">
            Pages
          </h1>
          <p className="text-sm text-muted-foreground">
            {limit === -1
              ? `${pages.length} pages · unlimited on ${planEntry.name}`
              : `${pages.length} / ${limit} pages on ${planEntry.name}`}
          </p>
        </div>
        {atLimit ? (
          <Button asChild>
            <Link href="/dashboard/upgrade?required=pro">
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade to add more
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/pages/new">
              <Plus className="mr-2 h-4 w-4" />
              Create new page
            </Link>
          </Button>
        )}
      </div>

      {/* Plan-limit warning banner */}
      {atLimit && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 animate-in-up"
          style={{ animationDelay: "50ms" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              You&apos;ve hit your plan limit of {limit} pages
            </p>
            <p className="mt-1">
              <Link
                href="/dashboard/upgrade"
                className="font-medium underline hover:opacity-90"
              >
                Upgrade
              </Link>{" "}
              to publish more, or pause an existing page to free up a slot.
            </p>
          </div>
        </div>
      )}

      {/* ── Card grid (or zero-state) ────────────────────────────────── */}
      {pages.length === 0 ? (
        <ZeroState />
      ) : (
        <div
          className="grid grid-cols-1 gap-4 animate-in-up sm:grid-cols-2 xl:grid-cols-3"
          style={{ animationDelay: "100ms" }}
        >
          {pages.map((p) => (
            <PageCard key={p.id} page={p} />
          ))}
          {/* "Create new page" tile lives in the grid so it fills the last
              row gracefully. When the seller is at limit it nudges to upgrade
              instead of /pages/new. */}
          <CreatePageTile disabled={atLimit} />
        </div>
      )}
    </div>
  );
}

function ZeroState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center animate-in-up"
      style={{ animationDelay: "100ms" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 ring-1 ring-inset ring-indigo-200/70">
        <FileText className="h-5 w-5 text-indigo-600" />
      </div>
      <h2 className="font-sora text-lg font-semibold">No pages yet</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Build your first payment or lead-capture page in under five minutes.
        You can pick from polished templates or start blank.
      </p>
      <Button asChild className="mt-2">
        <Link href="/dashboard/pages/new">
          <Plus className="mr-2 h-4 w-4" />
          Create your first page
        </Link>
      </Button>
    </div>
  );
}
