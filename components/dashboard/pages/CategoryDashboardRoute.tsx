import { redirect } from "next/navigation";

import { PagesDashboard } from "@/components/dashboard/pages/PagesDashboard";
import { getCategoryDashboard } from "@/lib/dashboard/page-category-queries";
import { type PageCategoryKey } from "@/lib/dashboard/page-categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/plans";

/**
 * Server component shared by all per-category Pages routes. Resolves the user,
 * their plan (for the page limit), and the category's pages + stats, then hands
 * everything to the client <PagesDashboard>.
 */
export async function CategoryDashboardRoute({
  categoryKey,
}: {
  categoryKey: PageCategoryKey;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [dashboard, { data: profile }, { count: totalPages }] = await Promise.all([
    getCategoryDashboard(user.id, categoryKey),
    admin
      .from("user_profiles")
      .select("subscription_plan, subscription_status")
      .eq("id", user.id)
      .single(),
    admin
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  // Plan limit is global (all pages count), not per-category.
  const planKey = (profile?.subscription_plan ?? "free") as PlanKey;
  const effective: PlanKey =
    planKey === "free" ||
    ["active", "trialing"].includes(profile?.subscription_status ?? "")
      ? planKey
      : "free";
  const planEntry = PLANS[effective in PLANS ? effective : "free"];
  const limit = planEntry.pages;
  const atLimit = limit !== -1 && (totalPages ?? 0) >= limit;

  return (
    <PagesDashboard
      categoryKey={categoryKey}
      pages={dashboard.pages}
      stats={dashboard.stats}
      atLimit={atLimit}
      planName={planEntry.name}
      limit={limit}
    />
  );
}
