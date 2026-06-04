import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  IndianRupee,
  TrendingDown,
  TrendingUp,
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
  RevenueByDayChart,
  MembersByPlanChart,
} from "@/components/dashboard/telegram/ChannelCharts";
import {
  TelegramMembersClient,
  type MemberRow,
} from "@/components/dashboard/telegram/TelegramMembersClient";
import { AutoRefresh } from "@/components/dashboard/telegram/AutoRefresh";
import { getChannelDashboardAction } from "@/actions/telegram-channels";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Telegram channel" };

const rupees = (n: number) => formatINR(n * 100);
const maskEmail = (e: string) =>
  e.replace(/^(.)(.*)(@.*)$/, (_m, a: string, _b: string, c: string) => `${a}***${c}`);

const TABS = ["overview", "members", "transactions", "insights", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function TelegramChannelPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const ctx = await requirePageActor("telegram.view", "/dashboard/telegram");

  const res = await getChannelDashboardAction(params.id);
  if (!res.ok || !res.data) notFound();
  const { group, plans, stats } = res.data;
  const groupName = group.group_name ?? "Channel";

  const tab: Tab = TABS.includes(searchParams.tab as Tab)
    ? (searchParams.tab as Tab)
    : "overview";

  // Member list only needed for the Members tab.
  let memberRows: MemberRow[] = [];
  if (tab === "members") {
    const admin = createAdminClient();
    const { data: memsRaw } = await admin
      .from("telegram_memberships")
      .select("id, buyer_email, telegram_user_id, status, joined_at, expires_at, invited_at, invite_link")
      .eq("telegram_group_id", params.id)
      .order("invited_at", { ascending: false })
      .limit(1000);
    memberRows = ((memsRaw ?? []) as MemberRow[]).map((m) => ({
      id: m.id,
      buyer_email: m.buyer_email,
      telegram_user_id: m.telegram_user_id,
      status: m.status,
      joined_at: m.joined_at,
      expires_at: m.expires_at,
      invited_at: m.invited_at,
      invite_link: m.invite_link ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Live-refresh the Overview + Members metrics every minute so join/leave
          and view counts stay current without a manual reload. */}
      {(tab === "overview" || tab === "members") && <AutoRefresh seconds={60} />}
      {/* Header */}
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href="/dashboard/telegram">
            <ArrowLeft className="mr-1 h-4 w-4" /> All channels
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0088cc] text-sm font-semibold text-white">
              {groupName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-sora font-semibold tracking-tight">{groupName}</h1>
              <p className="text-sm text-muted-foreground">
                {group.channel_username ? `@${group.channel_username} · ` : ""}
                {group.channel_type ?? "channel"}
                {group.setup_complete ? " · Live" : " · Draft"}
              </p>
            </div>
          </div>
          {group.pageUrl && (
            <Button asChild variant="outline">
              <Link href={group.pageUrl} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> View public page
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/dashboard/telegram/${group.id}?tab=${t}`}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MetricCard label="Page views" value={stats.totalPageViews.toLocaleString("en-IN")} icon={Eye} accentColor="indigo" />
            <MetricCard label="Total sales" value={rupees(stats.totalSales)} icon={IndianRupee} accentColor="emerald" />
            <MetricCard label="Subscriptions" value={stats.totalSubscriptions.toLocaleString("en-IN")} icon={Users} accentColor="indigo" />
            <MetricCard label="Active members" value={stats.activeMembers.toLocaleString("en-IN")} icon={TrendingUp} accentColor="emerald" />
            <MetricCard label="Churn (30d)" value={`${stats.churnRate}%`} icon={TrendingDown} accentColor="amber" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Revenue over time</CardTitle></CardHeader>
            <CardContent><RevenueByDayChart data={stats.salesByDay} /></CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Top members</CardTitle></CardHeader>
              <CardContent className="p-0">
                {stats.topMembers.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">No paying members yet.</p>
                ) : (
                  <ul className="divide-y">
                    {stats.topMembers.map((m, i) => (
                      <li key={i} className="flex items-center justify-between px-6 py-3 text-sm">
                        <span>{maskEmail(m.buyer_email)}</span>
                        <span className="font-medium">{rupees(m.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent transactions</CardTitle></CardHeader>
              <CardContent className="p-0">
                {stats.recentTransactions.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                  <ul className="divide-y">
                    {stats.recentTransactions.map((t, i) => (
                      <li key={i} className="flex items-center justify-between px-6 py-3 text-sm">
                        <span>{maskEmail(t.buyer_email)}<span className="ml-2 text-xs text-muted-foreground">{t.plan ?? ""}</span></span>
                        <span className="font-medium">{rupees(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <PlansPerformance plans={plans} />
        </div>
      )}

      {tab === "members" && (
        <TelegramMembersClient rows={memberRows} groupName={groupName} groupId={group.id} />
      )}

      {tab === "transactions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent transactions</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard/transactions">View all</Link></Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {stats.recentTransactions.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Buyer</TableHead><TableHead>Plan</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stats.recentTransactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{maskEmail(t.buyer_email)}</TableCell>
                      <TableCell className="text-muted-foreground">{t.plan ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                      <TableCell className="text-right font-medium">{rupees(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "insights" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Subscriptions" value={stats.totalSubscriptions.toLocaleString("en-IN")} accentColor="indigo" />
            <MetricCard label="Total sales" value={rupees(stats.totalSales)} accentColor="emerald" />
            <MetricCard label="Active" value={stats.activeMembers.toLocaleString("en-IN")} accentColor="emerald" />
            <MetricCard label="Page views" value={stats.totalPageViews.toLocaleString("en-IN")} accentColor="indigo" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Sales by day</CardTitle></CardHeader>
              <CardContent><RevenueByDayChart data={stats.salesByDay} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Subscribers by plan</CardTitle></CardHeader>
              <CardContent><MembersByPlanChart data={stats.membersByPlan} /></CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingLink href={`/dashboard/telegram/${group.id}/plans`} title="Edit plans & publish" desc="Edit prices, discounts, durations, most-popular tag; publish/unpublish." />
          <SettingLink href="/dashboard/coupons" title="Coupons" desc="Create discount codes for this channel's page." />
          <SettingLink href="/dashboard/settings/notifications" title="Automated emails" desc="Welcome, reminder, and expiry emails." />
          <SettingLink href="/dashboard/settings/tax-billing" title="GST & invoices" desc="Tax settings applied to each sale." />
        </div>
      )}
    </div>
  );
}

function PlansPerformance({
  plans,
}: {
  plans: Array<{ id: string; name: string; price: number; duration_label: string; subscriber_count: number; revenue: number }>;
}) {
  if (plans.length === 0) return null;
  const max = Math.max(1, ...plans.map((p) => p.subscriber_count));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Plan performance</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{p.name} <span className="text-xs text-muted-foreground">· {p.duration_label} · {rupees(p.price)}</span></span>
              <span className="text-muted-foreground">{p.subscriber_count} subs · {rupees(p.revenue)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(p.subscriber_count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </Link>
  );
}
