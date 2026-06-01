import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CreditCard,
  FileText,
  Inbox,
  Send,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
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
import { createClient } from "@/lib/supabase/server";
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [
    metrics,
    recent,
    topPages,
    { data: profile },
    { count: pagesCount },
  ] = await Promise.all([
    getDashboardMetrics(user.id),
    getRecentTransactions(user.id, 10),
    getTopPages(user.id, 5),
    admin
      .from("user_profiles")
      .select(
        "full_name, phone, avatar_url, kyc_level, bank_verified, razorpay_linked_account_id, onboarded_at, welcome_dismissed_at",
      )
      .eq("id", user.id)
      .single(),
    admin
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const onboardingProfile = {
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    avatar_url: profile?.avatar_url ?? null,
    kyc_level: profile?.kyc_level ?? null,
    bank_verified: profile?.bank_verified ?? null,
    razorpay_linked_account_id: profile?.razorpay_linked_account_id ?? null,
    onboarded_at: profile?.onboarded_at ?? null,
    welcome_dismissed_at: profile?.welcome_dismissed_at ?? null,
    pages_count: pagesCount ?? 0,
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
            name={profile?.full_name ?? user.email ?? "there"}
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
      <div
        className="animate-in-up"
        style={{ animationDelay: "50ms" }}
      >
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">A snapshot of your store this month.</p>
      </div>

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
          label="Pending Payout"
          value={rupees(metrics.pendingPayout)}
          icon={Wallet}
          accentColor="emerald"
          hint="Available to withdraw"
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

      {/* ── 3. Recent transactions + Top pages ───────────────────────── */}
      <div
        className="grid gap-6 animate-in-up lg:grid-cols-3"
        style={{ animationDelay: "200ms" }}
      >
        {/* LEFT — Recent transactions (2/3 width) */}
        <div className="card-surface overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="section-title">Recent Transactions</h2>
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
                    <TableRow key={row.id} className="border-border">
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
          <h2 className="section-title">Top Pages by Revenue</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
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
