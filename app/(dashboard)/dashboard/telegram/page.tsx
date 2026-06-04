import { redirect } from "next/navigation";

import {
  TelegramListClient,
  type ListChannel,
} from "@/components/dashboard/telegram/TelegramListClient";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { IntegrationTabs } from "@/components/dashboard/integrations/IntegrationTabs";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import { getCategoryDashboard } from "@/lib/dashboard/page-category-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Telegram" };

export default async function TelegramListPage() {
  const ctx = await requirePageActor("telegram.view", "/dashboard/telegram");

  const admin = createAdminClient();

  const [{ data: session }, { data: groupsRaw }] = await Promise.all([
    admin
      .from("telegram_user_sessions")
      .select("telegram_username")
      .eq("user_id", ctx.ownerId)
      .maybeSingle(),
    admin
      .from("telegram_vip_groups")
      .select(
        "id, group_name, group_id, channel_type, channel_username, logo_url, active_members, total_member_count, setup_complete, auto_page_id, page_id",
      )
      .eq("user_id", ctx.ownerId)
      // Only show set-up (bot-connected, published) channels — hide drafts.
      .eq("setup_complete", true)
      .order("created_at", { ascending: false }),
  ]);

  const groups = (groupsRaw ?? []) as Array<{
    id: string;
    group_name: string | null;
    group_id: string;
    channel_type: string | null;
    channel_username: string | null;
    logo_url: string | null;
    active_members: number | null;
    total_member_count: number | null;
    setup_complete: boolean | null;
    auto_page_id: string | null;
    page_id: string | null;
  }>;

  const pageIds = groups
    .map((g) => g.auto_page_id ?? g.page_id)
    .filter(Boolean) as string[];

  // Page slugs + per-page revenue + plans, fetched in bulk.
  const [{ data: pagesRaw }, { data: ordersRaw }, { data: plansRaw }] =
    await Promise.all([
      pageIds.length
        ? admin.from("pages").select("id, slug").in("id", pageIds)
        : Promise.resolve({ data: [] as Array<{ id: string; slug: string }> }),
      pageIds.length
        ? admin
            .from("orders")
            .select("page_id, amount")
            .eq("seller_user_id", ctx.ownerId)
            .eq("status", "paid")
            .in("page_id", pageIds)
        : Promise.resolve({ data: [] as Array<{ page_id: string; amount: number }> }),
      admin
        .from("telegram_subscription_plans")
        .select("group_id, name, price, sort_order")
        .eq("user_id", ctx.ownerId)
        .order("sort_order", { ascending: true }),
    ]);

  const slugByPage = new Map(
    ((pagesRaw ?? []) as Array<{ id: string; slug: string }>).map((p) => [p.id, p.slug]),
  );
  const revByPage = new Map<string, number>();
  for (const o of (ordersRaw ?? []) as Array<{ page_id: string; amount: number }>) {
    revByPage.set(o.page_id, (revByPage.get(o.page_id) ?? 0) + Number(o.amount ?? 0));
  }
  const plansByGroup = new Map<string, Array<{ name: string; price: number }>>();
  for (const p of (plansRaw ?? []) as Array<{ group_id: string; name: string; price: number }>) {
    const arr = plansByGroup.get(p.group_id) ?? [];
    arr.push({ name: p.name, price: Number(p.price ?? 0) });
    plansByGroup.set(p.group_id, arr);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

  const channels: ListChannel[] = groups.map((g) => {
    const pageId = g.auto_page_id ?? g.page_id;
    const slug = pageId ? slugByPage.get(pageId) : undefined;
    return {
      id: g.id,
      name: g.group_name ?? g.group_id,
      type: g.channel_type,
      username: g.channel_username,
      logoUrl: g.logo_url,
      activeMembers: Number(g.active_members ?? 0),
      memberCount: Number(g.total_member_count ?? 0),
      revenue: pageId ? revByPage.get(pageId) ?? 0 : 0,
      setupComplete: !!g.setup_complete,
      pageUrl: slug ? `${appUrl}/tg/${slug}` : null,
      plans: plansByGroup.get(g.id) ?? [],
    };
  });

  // Headline stats — revenue/sales sparklines come from the shared telegram
  // category query; channel + member counts from the groups above.
  const { stats } = await getCategoryDashboard(ctx.ownerId, "telegram");
  const totalMembers = channels.reduce((a, c) => a + c.activeMembers, 0);
  const salesSpark = stats.spark.map((s) => s.sales);
  const revenueSpark = stats.spark.map((s) => s.revenue);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Group Integrations"
        blurb="Connect your community platforms. Telegram: paid access, auto-invite on payment, auto-removal on expiry."
        gradient="from-sky-600 via-indigo-600 to-violet-600"
      />

      <IntegrationTabs />

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard
          label="Channels"
          value={channels.length.toLocaleString("en-IN")}
          trendPct={null}
          spark={salesSpark}
          color="#6366f1"
        />
        <PageStatCard
          label="Active Members"
          value={totalMembers.toLocaleString("en-IN")}
          trendPct={null}
          spark={salesSpark}
          color="#8b5cf6"
        />
        <PageStatCard
          label="Total Revenue"
          value={formatINR(stats.totalRevenue * 100)}
          trendPct={stats.revenueTrendPct}
          spark={revenueSpark}
          color="#10b981"
        />
        <PageStatCard
          label="Total Sales"
          value={stats.totalSales.toLocaleString("en-IN")}
          trendPct={stats.salesTrendPct}
          spark={salesSpark}
          color="#f59e0b"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <TelegramListClient
          connected={!!session}
          username={session?.telegram_username ?? null}
          channels={channels}
        />
      </div>
    </div>
  );
}
