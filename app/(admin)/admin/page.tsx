import Link from "next/link";
import { startOfMonth, startOfWeek, startOfDay, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey } from "@/lib/plans";
import { cn, formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Overview" };

const rupees = (n: number) => formatINR(n * 100);

// Tint per plan — used both on the active-subscriber chips under the
// metric card AND on the stacked-bar segments + legend below.
const PLAN_TINT: Record<
  PlanKey,
  { bar: string; chip: string; dot: string; label: string }
> = {
  free: {
    bar: "bg-zinc-300",
    chip: "bg-zinc-100 text-zinc-700 border-zinc-200",
    dot: "bg-zinc-400",
    label: "Free",
  },
  starter: {
    bar: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    label: "Starter",
  },
  pro: {
    bar: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    label: "Pro",
  },
  business: {
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    label: "Business",
  },
};

export default async function AdminOverview() {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const todayStart = startOfDay(now).toISOString();

  const [
    { data: paidThisMonth },
    { data: subsRaw },
    { count: signupsToday },
    { count: signupsThisWeek },
    { count: failedToday },
    { count: failedThisMonth },
    { count: kycPending },
    { count: kycReview },
    { data: auditRaw },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("amount, platform_commission")
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    admin
      .from("user_profiles")
      .select("subscription_plan, subscription_status, created_at"),
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", todayStart),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", monthStart),
    admin
      .from("kyc_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("kyc_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "under_review"),
    admin
      .from("admin_audit_logs")
      .select(
        "id, admin_id, action, target_type, target_id, created_at, user_profiles(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const gmv = (paidThisMonth ?? []).reduce(
    (acc, r) => acc + Number(r.amount ?? 0),
    0,
  );
  const commission = (paidThisMonth ?? []).reduce(
    (acc, r) => acc + Number(r.platform_commission ?? 0),
    0,
  );

  const subs = (subsRaw ?? []) as Array<{
    subscription_plan: string | null;
    subscription_status: string | null;
    created_at: string;
  }>;

  // Active subscribers per plan (this drives the breakdown chip row + chart)
  const activeByPlan: Record<PlanKey, number> = {
    free: 0,
    starter: 0,
    pro: 0,
    business: 0,
  };
  let churnedThisMonth = 0;
  for (const s of subs) {
    const planKey = ((s.subscription_plan ?? "free") in PLANS
      ? s.subscription_plan
      : "free") as PlanKey;
    const status = s.subscription_status ?? "inactive";
    if (status === "active" || status === "trialing") {
      activeByPlan[planKey] = (activeByPlan[planKey] ?? 0) + 1;
    }
    if (
      status === "cancelled" &&
      new Date(s.created_at) >= new Date(monthStart)
    ) {
      churnedThisMonth++;
    }
  }
  const totalActive = Object.values(activeByPlan).reduce((a, b) => a + b, 0);
  const totalPaying =
    activeByPlan.starter + activeByPlan.pro + activeByPlan.business;

  type AuditRow = {
    id: string;
    admin_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    created_at: string;
    user_profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
  };
  const auditLogs = (auditRaw ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-6">
      {/* ── Heading ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-end justify-between gap-3 animate-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="font-sora text-2xl font-semibold tracking-tight">
            Platform overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Live numbers across every seller, page, and order on InvoxAI.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {totalActive.toLocaleString("en-IN")} active accounts ·{" "}
          {totalPaying.toLocaleString("en-IN")} paying
        </div>
      </div>

      {/* ── Row 1 — Platform health metrics ─────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-4 animate-in-up lg:grid-cols-4"
        style={{ animationDelay: "100ms" }}
      >
        <MetricCard
          label="GMV This Month"
          value={rupees(gmv)}
          icon={TrendingUp}
          accentColor="indigo"
          hint="Gross merchandise volume"
        />
        <MetricCard
          label="Platform Revenue"
          value={rupees(commission)}
          icon={Wallet}
          accentColor="emerald"
          hint="Commission earned this month"
        />
        <ActiveSubscribersCard
          starter={activeByPlan.starter}
          pro={activeByPlan.pro}
          business={activeByPlan.business}
        />
        <MetricCard
          label="Churn This Month"
          value={churnedThisMonth.toLocaleString("en-IN")}
          icon={UserMinus}
          accentColor="rose"
          hint={
            churnedThisMonth === 0
              ? "No cancellations 🎉"
              : "Subscriptions cancelled"
          }
        />
      </div>

      {/* ── Row 2 — Activity metrics ────────────────────────────────── */}
      <div
        className="grid grid-cols-1 gap-4 animate-in-up md:grid-cols-3"
        style={{ animationDelay: "200ms" }}
      >
        <MetricCard
          label="Signups Today"
          value={(signupsToday ?? 0).toLocaleString("en-IN")}
          icon={UserPlus}
          accentColor="indigo"
          hint={`This week: ${(signupsThisWeek ?? 0).toLocaleString("en-IN")}`}
        />
        <MetricCard
          label="Failed Payments Today"
          value={(failedToday ?? 0).toLocaleString("en-IN")}
          icon={AlertCircle}
          accentColor={(failedToday ?? 0) > 0 ? "rose" : "emerald"}
          hint={`This month: ${(failedThisMonth ?? 0).toLocaleString("en-IN")}`}
        />
        <MetricCard
          label="KYC Pending"
          value={(kycPending ?? 0).toLocaleString("en-IN")}
          icon={ShieldCheck}
          accentColor={(kycPending ?? 0) > 0 ? "amber" : "emerald"}
          hint={`Under review: ${(kycReview ?? 0).toLocaleString("en-IN")}`}
        />
      </div>

      {/* ── Row 3 — Subscription chart + audit timeline ─────────────── */}
      <div
        className="grid gap-6 animate-in-up lg:grid-cols-2"
        style={{ animationDelay: "300ms" }}
      >
        <SubscriptionBreakdown activeByPlan={activeByPlan} />
        <AuditTimeline rows={auditLogs} />
      </div>
    </div>
  );
}

// ── Active subscribers card — value + Starter/Pro/Business pills below ──

function ActiveSubscribersCard({
  starter,
  pro,
  business,
}: {
  starter: number;
  pro: number;
  business: number;
}) {
  const total = starter + pro + business;
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50"
        >
          <Users className="h-4 w-4 text-amber-600" strokeWidth={2.25} />
        </span>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Active Subscribers
        </p>
      </div>
      <div className="mt-3 font-sora text-2xl font-bold tracking-tight text-foreground">
        {total.toLocaleString("en-IN")}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PlanChip plan="starter" count={starter} />
        <PlanChip plan="pro" count={pro} />
        <PlanChip plan="business" count={business} />
      </div>
    </div>
  );
}

function PlanChip({ plan, count }: { plan: PlanKey; count: number }) {
  const t = PLAN_TINT[plan];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        t.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {t.label}: {count}
    </span>
  );
}

// ── Subscription breakdown — stacked horizontal bar ────────────────────

function SubscriptionBreakdown({
  activeByPlan,
}: {
  activeByPlan: Record<PlanKey, number>;
}) {
  const order: PlanKey[] = ["free", "starter", "pro", "business"];
  const total = order.reduce((a, k) => a + activeByPlan[k], 0);

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold tracking-tight">
          Subscription breakdown
        </h2>
        <span className="text-xs text-muted-foreground">
          {total.toLocaleString("en-IN")} accounts
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Active accounts by plan
      </p>

      {/* Stacked bar — segments scale by share, hidden when 0 */}
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {total === 0 ? (
          <div className="h-full w-full bg-muted" />
        ) : (
          order.map((p) => {
            const pct = (activeByPlan[p] / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={p}
                className={cn("h-full", PLAN_TINT[p].bar)}
                style={{ width: `${pct}%` }}
                title={`${PLAN_TINT[p].label}: ${activeByPlan[p]} (${pct.toFixed(1)}%)`}
              />
            );
          })
        )}
      </div>

      {/* Legend — one row per plan with count + percentage */}
      <ul className="mt-4 space-y-2">
        {order.map((p) => {
          const count = activeByPlan[p];
          const pct = total > 0 ? (count / total) * 100 : 0;
          const t = PLAN_TINT[p];
          return (
            <li
              key={p}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", t.dot)} />
                <span className="font-medium">{t.label}</span>
                {p !== "free" && (
                  <span className="text-xs text-muted-foreground">
                    ₹{PLANS[p].price}/mo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-sm">
                <span className="text-foreground">
                  {count.toLocaleString("en-IN")}
                </span>
                <span className="w-12 text-right text-xs text-muted-foreground">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Audit log timeline ─────────────────────────────────────────────────

type AuditRow = {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
  user_profiles:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null;
};

function AuditTimeline({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold tracking-tight">
          Recent admin activity
        </h2>
        <Link
          href="/admin/audit-logs"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
          No admin actions yet.
        </p>
      ) : (
        <ol className="relative mt-4 space-y-3">
          {/* Connecting trail line */}
          <span
            aria-hidden
            className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
          />
          {rows.map((r) => {
            const adminProfile = Array.isArray(r.user_profiles)
              ? r.user_profiles[0]
              : r.user_profiles;
            const who =
              adminProfile?.full_name ??
              adminProfile?.email ??
              (r.admin_id ? `${r.admin_id.slice(0, 8)}…` : "system");
            return (
              <li key={r.id} className="relative pl-5 text-sm">
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                        {r.action}
                      </code>
                      {r.target_type && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          on {r.target_type}
                          {r.target_id && ` · ${r.target_id.slice(0, 8)}`}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      by {who}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs text-muted-foreground"
                    title={new Date(r.created_at).toISOString()}
                  >
                    {formatDistanceToNow(new Date(r.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
