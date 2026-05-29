import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageCard, type PageCardData } from "@/components/dashboard/PageCard";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
          <p className="text-sm text-muted-foreground">
            {limit === -1
              ? `${pages.length} pages · unlimited on ${planEntry.name}`
              : `${pages.length} / ${limit} pages on ${planEntry.name}`}
          </p>
        </div>
        {atLimit ? (
          <Button asChild>
            <Link href={`/dashboard/upgrade?required=pro`}>
              <Plus className="mr-2 h-4 w-4" />
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

      {atLimit && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You&apos;ve hit your plan limit of {limit} pages.{" "}
          <Link href="/dashboard/upgrade" className="underline">
            Upgrade
          </Link>{" "}
          to publish more, or pause an existing page.
        </div>
      )}

      {pages.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-12 text-center">
          <h2 className="text-lg font-semibold">No pages yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your first payment or lead-capture page in under five minutes.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/pages/new">
              <Plus className="mr-2 h-4 w-4" />
              Create your first page
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => (
            <PageCard key={p.id} page={p} />
          ))}
        </div>
      )}
    </div>
  );
}
