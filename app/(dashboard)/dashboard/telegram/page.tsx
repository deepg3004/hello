import { redirect } from "next/navigation";

import {
  TelegramListClient,
  type ListChannel,
} from "@/components/dashboard/telegram/TelegramListClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Telegram" };

export default async function TelegramListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: session }, { data: groupsRaw }] = await Promise.all([
    admin
      .from("telegram_user_sessions")
      .select("telegram_username")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("telegram_vip_groups")
      .select(
        "id, group_name, group_id, channel_type, channel_username, logo_url, active_members, total_member_count, setup_complete, auto_page_id, page_id",
      )
      .eq("user_id", user.id)
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
            .eq("seller_user_id", user.id)
            .eq("status", "paid")
            .in("page_id", pageIds)
        : Promise.resolve({ data: [] as Array<{ page_id: string; amount: number }> }),
      admin
        .from("telegram_subscription_plans")
        .select("group_id, name, price, sort_order")
        .eq("user_id", user.id)
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
      pageUrl: slug ? `${appUrl}/p/${slug}` : null,
      plans: plansByGroup.get(g.id) ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          My Telegram Channels
        </h1>
        <p className="text-sm text-muted-foreground">
          Paid access, auto-invite on payment, and auto-removal on expiry.
        </p>
      </div>
      <TelegramListClient
        connected={!!session}
        username={session?.telegram_username ?? null}
        channels={channels}
      />
    </div>
  );
}
