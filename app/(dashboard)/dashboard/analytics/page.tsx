import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ShoppingCart, TrendingUp, IndianRupee, MailOpen } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Abandoned-cart analytics" };

interface Row {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  amount: number | string | null;
  status: string;
  recovery_step: number | null;
  step_reached: string | null;
  recovery_email1_sent_at: string | null;
  recovery_email2_sent_at: string | null;
  recovery_whatsapp_sent_at: string | null;
  email_opens: number | null;
  page_id: string | null;
  seller_user_id: string | null;
  created_at: string;
  recovered_at: string | null;
}

interface JoinedRow extends Row {
  pages?: { title?: string | null; slug?: string | null } | null;
  user_profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const inr = (n: number) => `₹${fmt(n)}`;

export default async function AnalyticsPage() {
  const ctx = await requirePageActor("analytics.view", "/dashboard/analytics");

  const admin = createAdminClient();

  const { data: meRow } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", ctx.ownerId)
    .single();
  const isAdmin = !!meRow?.is_admin;

  // Window: this calendar month so far.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // ---- Aggregate metrics ----
  // We do two parallel queries — recent (table) and month buckets (metrics).
  const baseQuery = admin
    .from("abandoned_checkouts")
    .select(
      "id, buyer_email, buyer_name, buyer_phone, amount, status, recovery_step, step_reached, recovery_email1_sent_at, recovery_email2_sent_at, recovery_whatsapp_sent_at, email_opens, page_id, seller_user_id, created_at, recovered_at, pages(title, slug), user_profiles!abandoned_checkouts_seller_user_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false });

  // Recent table — 25 rows
  const recentQ = isAdmin
    ? baseQuery.limit(25)
    : baseQuery.eq("seller_user_id", ctx.ownerId).limit(25);
  const { data: recentRaw } = await recentQ;
  const recent = (recentRaw ?? []) as JoinedRow[];

  // Month buckets
  const monthQ = admin
    .from("abandoned_checkouts")
    .select("status, amount, recovery_email1_sent_at, recovery_email2_sent_at, email_opens", { count: "exact" })
    .gte("created_at", monthStart);
  const finalMonthQ = isAdmin
    ? monthQ
    : monthQ.eq("seller_user_id", ctx.ownerId);
  const { data: month } = await finalMonthQ;

  const total = month?.length ?? 0;
  let recovered = 0;
  let recoveredRevenue = 0;
  let emailsSent = 0;
  let opens = 0;
  let cartsEmailed = 0; // distinct carts that received ≥1 recovery email
  let cartsOpened = 0; // distinct carts that opened ≥1 email
  for (const r of month ?? []) {
    if (r.status === "recovered") {
      recovered += 1;
      recoveredRevenue += Number(r.amount ?? 0);
    }
    if (r.recovery_email1_sent_at) emailsSent += 1;
    if (r.recovery_email2_sent_at) emailsSent += 1;
    if (r.recovery_email1_sent_at || r.recovery_email2_sent_at) cartsEmailed += 1;
    if (Number(r.email_opens ?? 0) > 0) cartsOpened += 1;
    opens += Number(r.email_opens ?? 0);
  }
  const recoveryRate = total > 0 ? (recovered / total) * 100 : 0;
  const openRate = emailsSent > 0 ? (opens / emailsSent) * 100 : 0;

  // Funnel stages — each step of the abandoned-cart recovery sequence.
  const funnelStages = [
    { label: "Abandoned", value: total, bar: "bg-gradient-to-r from-indigo-500 to-indigo-400" },
    { label: "Recovery email sent", value: cartsEmailed, bar: "bg-gradient-to-r from-violet-500 to-violet-400" },
    { label: "Opened an email", value: cartsOpened, bar: "bg-gradient-to-r from-amber-500 to-amber-400" },
    { label: "Recovered", value: recovered, bar: "bg-gradient-to-r from-emerald-500 to-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Abandoned-cart recovery"
        gradient="from-rose-600 via-orange-600 to-amber-600"
        blurb={
          isAdmin
            ? "Platform-wide funnel — every seller's abandoned carts this month."
            : "Your funnel this month — every checkout that started but didn't finish."
        }
      >
        {isAdmin && (
          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            Admin view
          </Badge>
        )}
      </DashboardHero>

      <div
        className="grid gap-4 animate-in-up sm:grid-cols-2 lg:grid-cols-4"
        style={{ animationDelay: "60ms" }}
      >
        <MetricCard
          label="Abandoned this month"
          value={fmt(total)}
          icon={ShoppingCart}
          accentColor="indigo"
          hint="Pre-captured + not yet paid"
        />
        <MetricCard
          label="Recovery rate"
          value={`${recoveryRate.toFixed(1)}%`}
          icon={TrendingUp}
          accentColor="emerald"
          hint={`${fmt(recovered)} of ${fmt(total)} carts`}
        />
        <MetricCard
          label="Recovered revenue"
          value={inr(recoveredRevenue)}
          icon={IndianRupee}
          accentColor="amber"
          hint="Carts that converted after pre-capture"
        />
        <MetricCard
          label="Email opens"
          value={`${fmt(opens)} / ${fmt(emailsSent)}`}
          icon={MailOpen}
          accentColor="rose"
          hint={`${openRate.toFixed(0)}% open rate`}
        />
      </div>

      {/* Recovery funnel — share of carts reaching each stage this month */}
      <div className="animate-in-up" style={{ animationDelay: "90ms" }}>
        <RecoveryFunnel stages={funnelStages} total={total} />
      </div>

      <Card className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <CardTitle className="text-base">Recent abandoned carts</CardTitle>
          <CardDescription>
            Latest 25. Each row carries the buyer, the page, the step they
            reached, and where the recovery sequence is.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                {isAdmin && <TableHead>Seller</TableHead>}
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Recovery</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 8 : 7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
                        <ShoppingCart className="h-5 w-5" />
                      </div>
                      No abandoned checkouts captured yet. Add the
                      CheckoutForm to a live page to start tracking.
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {recent.map((r) => {
                const seller = Array.isArray(r.user_profiles)
                  ? r.user_profiles[0]
                  : r.user_profiles;
                const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
                const stepLabel = recoveryStepLabel(r);
                return (
                  <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div>{r.buyer_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.buyer_email}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-muted-foreground">
                        {seller?.full_name ?? seller?.email ?? "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {page?.slug ? (
                        <Link
                          href={`/p/${page.slug}`}
                          target="_blank"
                          className="hover:underline"
                        >
                          {page.title ?? page.slug}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.amount != null ? inr(Number(r.amount)) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {prettyStep(r.step_reached)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stepLabel}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RecoveryFunnel({
  stages,
  total,
}: {
  stages: { label: string; value: number; bar: string }[];
  total: number;
}) {
  return (
    <div className="card-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sora text-base font-semibold tracking-tight">
          Recovery funnel
        </h2>
        <span className="text-xs text-muted-foreground">
          This month · {fmt(total)} carts entered
        </span>
      </div>
      <div className="mt-4 space-y-3.5">
        {stages.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">
                    {fmt(s.value)}
                  </span>{" "}
                  · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${s.bar}`}
                  style={{ width: `${s.value > 0 ? Math.max(pct, 3) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function recoveryStepLabel(r: Row): string {
  const parts: string[] = [];
  if (r.recovery_email1_sent_at) parts.push("E1");
  if (r.recovery_whatsapp_sent_at) parts.push("WA");
  if (r.recovery_email2_sent_at) parts.push("E2");
  if (parts.length === 0) return "—";
  return parts.join(" · ");
}

function prettyStep(s: string | null): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
