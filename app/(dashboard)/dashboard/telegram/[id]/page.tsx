import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  IndianRupee,
  TrendingUp,
  UserMinus,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  PublicPageCard,
  type PublicPlan,
} from "@/components/dashboard/telegram/PublicPageCard";
import {
  TelegramMembersClient,
  type MemberRow,
} from "@/components/dashboard/telegram/TelegramMembersClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Telegram group" };

// orders.amount is stored in rupees (decimal). formatINR expects paise, so
// scale up — same convention as components/dashboard/TransactionsClient.tsx.
const rupees = (n: number) => formatINR(n * 100);

export default async function TelegramGroupDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: groupRaw } = await admin
    .from("telegram_vip_groups")
    .select(
      "id, group_name, group_id, bot_username, access_duration_days, auto_renewal_enabled, active_members, user_id, page_id, pages(title, slug)",
    )
    .eq("id", params.id)
    .maybeSingle();

  // Ownership guard — a seller may only view their own group.
  if (!groupRaw || (groupRaw as { user_id: string }).user_id !== user.id) {
    notFound();
  }

  const group = groupRaw as unknown as {
    id: string;
    group_name: string | null;
    group_id: string;
    bot_username: string | null;
    access_duration_days: number | null;
    auto_renewal_enabled: boolean | null;
    active_members: number | null;
    page_id: string | null;
    pages:
      | { title: string; slug: string }
      | { title: string; slug: string }[]
      | null;
  };
  const page = Array.isArray(group.pages) ? group.pages[0] : group.pages;
  const groupName = group.group_name ?? group.group_id;

  // Memberships for this group (disambiguate to the new telegram_group_id FK
  // that the lifecycle code writes — see admin/telegram/page.tsx).
  const { data: memsRaw } = await admin
    .from("telegram_memberships")
    .select(
      "id, buyer_email, telegram_user_id, status, joined_at, expires_at, invited_at, order_id",
    )
    .eq("telegram_group_id", params.id)
    .order("invited_at", { ascending: false })
    .limit(1000);

  const mems = (memsRaw ?? []) as unknown as Array<{
    id: string;
    buyer_email: string;
    telegram_user_id: string | null;
    status: string;
    joined_at: string | null;
    expires_at: string | null;
    invited_at: string | null;
    order_id: string | null;
  }>;

  // Orders that granted these memberships → revenue + recent transactions.
  const orderIds = Array.from(
    new Set(mems.map((m) => m.order_id).filter(Boolean)),
  ) as string[];

  let orders: Array<{
    id: string;
    amount: number;
    status: string;
    buyer_email: string;
    buyer_name: string | null;
    created_at: string;
  }> = [];
  if (orderIds.length > 0) {
    const { data: ordersRaw } = await admin
      .from("orders")
      .select("id, amount, status, buyer_email, buyer_name, created_at")
      .in("id", orderIds)
      .order("created_at", { ascending: false });
    orders = (ordersRaw ?? []) as unknown as typeof orders;
  }

  // Active plans on the linked page → shown in the public-page card.
  let plans: PublicPlan[] = [];
  if (group.page_id) {
    const { data: prodRaw } = await admin
      .from("products")
      .select("id, display_label, name, price, subscription_days, sort_order")
      .eq("page_id", group.page_id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    plans = ((prodRaw ?? []) as unknown as Array<{
      id: string;
      display_label: string | null;
      name: string | null;
      price: number;
      subscription_days: number | null;
    }>).map((p) => ({
      id: p.id,
      label: p.display_label ?? p.name ?? "Plan",
      price: Number(p.price ?? 0),
      subscription_days: p.subscription_days,
    }));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  const publicUrl = page ? `${appUrl}/p/${page.slug}` : null;

  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce((acc, o) => acc + Number(o.amount ?? 0), 0);
  const totalSubs = mems.length;
  const activeCount = mems.filter((m) => m.status === "active").length;
  const expiredCount = mems.filter((m) => m.status === "expired").length;
  const recent = paid.slice(0, 5);

  const tab = searchParams.tab === "members" ? "members" : "overview";

  const memberRows: MemberRow[] = mems.map((m) => ({
    id: m.id,
    buyer_email: m.buyer_email,
    telegram_user_id: m.telegram_user_id,
    status: m.status,
    joined_at: m.joined_at,
    expires_at: m.expires_at,
    invited_at: m.invited_at,
  }));

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "members", label: `Members (${activeCount})` },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href="/dashboard/telegram">
            <ArrowLeft className="mr-1 h-4 w-4" /> All Telegram groups
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-sora font-semibold tracking-tight">
              {groupName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {group.bot_username ? `@${group.bot_username} · ` : ""}
              {group.access_duration_days === 0 || group.access_duration_days == null
                ? "Lifetime access"
                : `${group.access_duration_days}-day access`}
              {group.auto_renewal_enabled ? " · Renewals on" : ""}
            </p>
          </div>
          {page && (
            <Button asChild variant="outline">
              <Link href={`/p/${page.slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> View page
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/telegram/${group.id}?tab=${t.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Total subscriptions"
              value={totalSubs.toLocaleString("en-IN")}
              icon={Users}
              accentColor="indigo"
            />
            <MetricCard
              label="Revenue"
              value={rupees(revenue)}
              hint="Paid orders"
              icon={IndianRupee}
              accentColor="emerald"
            />
            <MetricCard
              label="Active members"
              value={activeCount.toLocaleString("en-IN")}
              icon={TrendingUp}
              accentColor="emerald"
            />
            <MetricCard
              label="Expired"
              value={expiredCount.toLocaleString("en-IN")}
              icon={UserMinus}
              accentColor="amber"
            />
          </div>

          {publicUrl ? (
            <PublicPageCard url={publicUrl} plans={plans} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-6">
                <div>
                  <CardTitle className="text-base">No public page linked</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Link a payment page to this group so buyers can subscribe and
                    get auto-invited.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/telegram/setup">Link a page</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent transactions</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/transactions">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {recent.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No paid transactions for this group yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="font-medium">
                            {o.buyer_name ?? o.buyer_email}
                          </div>
                          {o.buyer_name && (
                            <div className="text-xs text-muted-foreground">
                              {o.buyer_email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(o.created_at)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {rupees(Number(o.amount ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <TelegramMembersClient rows={memberRows} groupName={groupName} />
      )}
    </div>
  );
}
