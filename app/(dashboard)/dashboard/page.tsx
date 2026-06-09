import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subMonths } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CreditCard,
  FileText,
  Handshake,
  IndianRupee,
  Inbox,
  Layers,
  Magnet,
  Receipt,
  Send,
  ShoppingCart,
  Tag,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EarningsCard, type EarningsPoint } from "@/components/dashboard/EarningsCard";
import { RevenueBars } from "@/components/dashboard/RevenueBars";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardMetrics,
  getRecentTransactions,
  getTopPages,
} from "@/lib/dashboard/queries";
import { getActorContext } from "@/lib/account-context";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatINR, truncate } from "@/lib/utils";
import {
  buildOnboardingSteps,
  computeOnboardingProgress,
  shouldShowWelcomeBanner,
} from "@/lib/onboarding";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";

export const metadata = {
  title: "Overview",
};

function rupees(n: number) {
  // queries.ts returns rupees (not paise) for revenue/payout/commission
  // fields, so multiply ×100 to match formatINR's paise contract.
  return formatINR(n * 100);
}

function trendVsLastMonth(thisMonth: number, lastMonth: number) {
  if (lastMonth <= 0) return null;
  const diffPct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  if (diffPct === 0) return null;
  return {
    direction: (diffPct >= 0 ? "up" : "down") as "up" | "down",
    label: `${diffPct >= 0 ? "+" : ""}${diffPct}%`,
  };
}

export default async function DashboardOverview() {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");

  const admin = createAdminClient();
  const yearAgo = subMonths(new Date(), 11);
  const yearStart = new Date(
    yearAgo.getFullYear(),
    yearAgo.getMonth(),
    1,
  ).toISOString();
  const [
    metrics,
    recent,
    topPages,
    { data: profile },
    { count: pagesCount },
    { data: yearOrders },
    { count: leadsCount },
    { count: gatewayCount },
  ] = await Promise.all([
    getDashboardMetrics(ctx.ownerId),
    getRecentTransactions(ctx.ownerId, 10),
    getTopPages(ctx.ownerId, 5),
    admin
      .from("user_profiles")
      .select(
        "full_name, phone, avatar_url, onboarded_at, welcome_dismissed_at, creator_category",
      )
      .eq("id", ctx.ownerId)
      .single(),
    admin
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.ownerId),
    // Paid orders over the trailing 12 months — drives the earnings chart,
    // this-month order count, and average order value.
    admin
      .from("orders")
      .select("amount, created_at")
      .eq("seller_user_id", ctx.ownerId)
      .eq("status", "paid")
      .gte("created_at", yearStart),
    admin
      .from("lead_captures")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", ctx.ownerId),
    admin
      .from("seller_gateway_config")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", ctx.ownerId)
      .eq("is_active", true),
  ]);

  // ── Earnings series (last 12 months) + derived KPIs ──────────────────
  const paidYear = (yearOrders ?? []) as Array<{
    amount: number;
    created_at: string;
  }>;
  const byMonth = new Map<string, number>();
  for (const o of paidYear) {
    const k = String(o.created_at).slice(0, 7); // yyyy-MM
    byMonth.set(k, (byMonth.get(k) ?? 0) + Number(o.amount ?? 0));
  }
  const earnings: EarningsPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = format(d, "yyyy-MM");
    earnings.push({
      key,
      label: d.getMonth() === 0 ? format(d, "MMM yy") : format(d, "MMM"),
      value: byMonth.get(key) ?? 0,
    });
  }
  const thisMonthKey = format(new Date(), "yyyy-MM");
  const ordersThisMonth = paidYear.filter(
    (o) => String(o.created_at).slice(0, 7) === thisMonthKey,
  ).length;
  const avgOrderValue =
    ordersThisMonth > 0 ? metrics.revenueThisMonth / ordersThisMonth : 0;

  const onboardingProfile = {
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    avatar_url: profile?.avatar_url ?? null,
    onboarded_at: profile?.onboarded_at ?? null,
    welcome_dismissed_at: profile?.welcome_dismissed_at ?? null,
    creator_category: (profile as { creator_category?: string | null })?.creator_category ?? null,
    pages_count: pagesCount ?? 0,
    gateway_connected: (gatewayCount ?? 0) > 0,
    paid_orders_count: paidYear.length,
  };
  const onboardingSteps = buildOnboardingSteps(onboardingProfile);
  const onboardingProgress = computeOnboardingProgress(onboardingSteps);
  const showWelcome = shouldShowWelcomeBanner(onboardingProfile);
  const nextStep = onboardingSteps.find((s) => !s.done);

  const noPages = (pagesCount ?? 0) === 0;
  const revTrend = trendVsLastMonth(
    metrics.revenueThisMonth,
    metrics.revenueLastMonth,
  );

  return (
    <div className="space-y-6">
      {/* ── 1. Welcome banner ─────────────────────────────────────────── */}
      {showWelcome && (
        <div className="animate-in-up" style={{ animationDelay: "0ms" }}>
          <WelcomeBanner
            name={profile?.full_name ?? "there"}
            progress={onboardingProgress}
            next={
              nextStep
                ? { label: nextStep.cta_label, href: nextStep.cta_href }
                : null
            }
            steps={onboardingSteps.map((s) => ({
              label: s.title,
              done: s.done,
            }))}
          />
        </div>
      )}

      {/* ── Page heading ─────────────────────────────────────────────── */}
      <DashboardHero
        title="Overview"
        gradient="from-indigo-600 via-violet-600 to-purple-600"
        blurb="A snapshot of your store this month."
      />

      {/* ── 2. Metrics grid ──────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-4 animate-in-up lg:grid-cols-4"
        style={{ animationDelay: "100ms" }}
      >
        <MetricCard
          label="Revenue (this month)"
          value={rupees(metrics.revenueThisMonth)}
          icon={TrendingUp}
          accentColor="indigo"
          trend={revTrend ?? undefined}
          hint={
            metrics.revenueLastMonth > 0
              ? `vs ${rupees(metrics.revenueLastMonth)} last month`
              : "Last month: no sales"
          }
        />
        <MetricCard
          label="Avg order value"
          value={rupees(avgOrderValue)}
          icon={Wallet}
          accentColor="emerald"
          hint="Per paid order this month"
        />
        <MetricCard
          label="Total Customers"
          value={metrics.totalCustomers.toLocaleString("en-IN")}
          icon={Users}
          accentColor="amber"
          hint="Unique buyers across all pages"
        />
        <MetricCard
          label="Failed Payments"
          value={metrics.failedLast24h.toLocaleString("en-IN")}
          icon={AlertCircle}
          accentColor="rose"
          hint="In the last 24 hours"
        />
      </div>

      {/* ── 2b. Secondary KPIs ───────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-4 animate-in-up lg:grid-cols-4"
        style={{ animationDelay: "150ms" }}
      >
        <MetricCard
          label="Orders (this month)"
          value={ordersThisMonth.toLocaleString("en-IN")}
          icon={ShoppingCart}
          accentColor="indigo"
          hint="Paid orders since the 1st"
        />
        <MetricCard
          label="Avg Order Value"
          value={rupees(avgOrderValue)}
          icon={IndianRupee}
          accentColor="emerald"
          hint="Revenue ÷ orders this month"
        />
        <MetricCard
          label="Total Leads"
          value={(leadsCount ?? 0).toLocaleString("en-IN")}
          icon={Magnet}
          accentColor="amber"
          hint="Captured across all pages"
        />
        <MetricCard
          label="Active Pages"
          value={metrics.activePages.toLocaleString("en-IN")}
          icon={Layers}
          accentColor="violet"
          hint="Published & collecting"
        />
      </div>

      {/* ── 2c. Earnings trend ────────────────────────────────────────── */}
      <div className="animate-in-up" style={{ animationDelay: "180ms" }}>
        <EarningsCard series={earnings} />
      </div>

      {/* ── 3. Recent transactions + Top pages ───────────────────────── */}
      <div
        className="grid gap-6 animate-in-up lg:grid-cols-3"
        style={{ animationDelay: "200ms" }}
      >
        {/* LEFT — Recent transactions (2/3 width) */}
        <div className="card-surface overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="tile-indigo flex h-8 w-8 items-center justify-center rounded-lg"
              >
                <Receipt className="h-4 w-4" />
              </span>
              <h2 className="section-title">Recent Transactions</h2>
            </div>
            <Link
              href="/dashboard/transactions"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyTransactions />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="th-label">
                      Buyer
                    </TableHead>
                    <TableHead className="th-label">
                      Page
                    </TableHead>
                    <TableHead className="text-right th-label">
                      Amount
                    </TableHead>
                    <TableHead className="th-label">
                      Status
                    </TableHead>
                    <TableHead className="th-label">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="py-3">
                        <div className="font-medium text-foreground">
                          {row.buyer_name ?? row.buyer_email}
                        </div>
                        {row.buyer_name && (
                          <div className="text-xs text-muted-foreground">
                            {row.buyer_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground"
                        title={row.page_title ?? undefined}
                      >
                        {row.page_title
                          ? truncate(row.page_title, 24)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                        {rupees(row.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* RIGHT — Top pages (1/3 width) */}
        <div className="card-surface p-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="tile-amber flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <Trophy className="h-4 w-4" />
            </span>
            <h2 className="section-title">Top Pages by Revenue</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sorted by lifetime revenue
          </p>
          <div className="mt-4">
            <RevenueBars rows={topPages} />
          </div>
          {topPages.length > 0 && (
            <Link
              href="/dashboard/pages"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all pages
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* ── 3b. Quick links — always available shortcuts ─────────────── */}
      <div
        className="card-surface p-5 animate-in-up"
        style={{ animationDelay: "250ms" }}
      >
        <h2 className="section-title mb-4">Quick links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Shortcut href="/dashboard/pages/new" icon={CreditCard} accent="indigo" label="New Page" />
          <Shortcut href="/dashboard/wallet" icon={Wallet} accent="emerald" label="Wallet" />
          <Shortcut href="/dashboard/coupons" icon={Tag} accent="amber" label="Coupons" />
          <Shortcut href="/dashboard/affiliates" icon={Handshake} accent="violet" label="Affiliates" />
          <Shortcut href="/dashboard/telegram" icon={Send} accent="indigo" label="Telegram" />
          <Shortcut href="/dashboard/customers" icon={Users} accent="emerald" label="Customers" />
        </div>
      </div>

      {/* ── 4. Quick Actions (only when no pages exist yet) ──────────── */}
      {noPages && (
        <div
          className="animate-in-up"
          style={{ animationDelay: "300ms" }}
        >
          <div className="mb-4">
            <h2 className="section-title">Quick start</h2>
            <p className="page-subtitle">
              Create your first page to start collecting payments.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <QuickAction
              href="/dashboard/pages/new"
              icon={CreditCard}
              accent="indigo"
              title="Create Payment Page"
              description="A simple checkout for a digital product, course, or service."
            />
            <QuickAction
              href="/dashboard/pages/new"
              icon={FileText}
              accent="amber"
              title="Create Landing Page"
              description="Capture leads or sell with a long-form sales page."
            />
            <QuickAction
              href="/dashboard/pages/new"
              icon={Send}
              accent="emerald"
              title="Setup Telegram VIP"
              description="Auto-invite buyers to your private group; auto-remove on expiry."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function EmptyTransactions() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="tile-indigo flex h-12 w-12 items-center justify-center rounded-full">
        <Inbox className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-foreground">No transactions yet</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Share your payment page to start collecting orders.
        </p>
      </div>
      <Button asChild size="sm" className="mt-1">
        <Link href="/dashboard/pages/new">Create a page</Link>
      </Button>
    </div>
  );
}

type QuickActionAccent = "indigo" | "amber" | "emerald";

// Reuse the shared dark-aware tile utilities (globals.css) — gradient + ring +
// icon colour all come from one class.
const QUICK_TILE: Record<QuickActionAccent, string> = {
  indigo: "tile-indigo",
  amber: "tile-amber",
  emerald: "tile-emerald",
};

const SHORTCUT_TILE: Record<"indigo" | "emerald" | "amber" | "violet", string> = {
  indigo: "tile-indigo",
  emerald: "tile-emerald",
  amber: "tile-amber",
  violet: "tile-violet",
};

function Shortcut({
  href,
  icon: Icon,
  accent,
  label,
}: {
  href: string;
  icon: typeof CreditCard;
  accent: "indigo" | "emerald" | "amber" | "violet";
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card-surface card-surface-hover group flex flex-col items-center gap-2 p-4 text-center hover:border-primary/30"
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${SHORTCUT_TILE[accent]}`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
        {label}
      </span>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  accent,
  title,
  description,
}: {
  href: string;
  icon: typeof CreditCard;
  accent: QuickActionAccent;
  title: string;
  description: string;
}) {
  const tile = QUICK_TILE[accent];
  return (
    <Link
      href={href}
      className="card-surface card-surface-hover group flex items-start gap-4 p-5 hover:border-primary/30"
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sora text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
