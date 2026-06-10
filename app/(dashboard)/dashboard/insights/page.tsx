import Link from "next/link";
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Undo2,
  Percent,
  Users,
  Repeat,
  BarChart3,
} from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const rupees = (n: number) => formatINR(Math.round(n * 100));

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

interface OrderLite {
  amount: number;
  status: string;
  buyer_email: string;
  product_id: string | null;
  source: string | null;
  created_at: string;
  products: { name: string } | { name: string }[] | null;
  pages: { title: string } | { title: string }[] | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  bump: "Order bump",
  oto: "One-time offer",
  affiliate: "Affiliate",
  cart: "Cart",
};

/** Bucket paid revenue into an ordered trend series sized to the window:
 *  ≤30d → daily, ≤90d → weekly, else monthly. Empty buckets render as zero. */
function buildTrend(
  paid: OrderLite[],
  days: number,
): { label: string; revenue: number }[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const buckets: { key: string; label: string; revenue: number }[] = [];
  const idx = new Map<string, number>();
  const push = (key: string, label: string) => {
    idx.set(key, buckets.length);
    buckets.push({ key, label, revenue: 0 });
  };

  if (days <= 30) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      push(d.toISOString().slice(0, 10), `${d.getUTCDate()}/${d.getUTCMonth() + 1}`);
    }
    for (const o of paid) {
      const i = idx.get(String(o.created_at).slice(0, 10));
      if (i !== undefined) buckets[i].revenue += Number(o.amount || 0);
    }
  } else if (days <= 90) {
    const weeks = Math.ceil(days / 7);
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now - i * 7 * DAY);
      push(`w${i}`, `${d.getUTCDate()}/${d.getUTCMonth() + 1}`);
    }
    for (const o of paid) {
      const weeksAgo = Math.floor((now - new Date(o.created_at).getTime()) / (7 * DAY));
      const pos = weeks - 1 - weeksAgo;
      if (pos >= 0 && pos < buckets.length) buckets[pos].revenue += Number(o.amount || 0);
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - i);
      push(d.toISOString().slice(0, 7), MONTHS[d.getUTCMonth()]);
    }
    for (const o of paid) {
      const i = idx.get(String(o.created_at).slice(0, 7));
      if (i !== undefined) buckets[i].revenue += Number(o.amount || 0);
    }
  }
  return buckets.map(({ label, revenue }) => ({ label, revenue }));
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const ctx = await requirePageActor("transactions.view", "/dashboard/insights");

  const days = WINDOWS.some((w) => String(w.days) === searchParams.days)
    ? Number(searchParams.days)
    : 90;
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const admin = createAdminClient();
  const { data: raw } = await admin
    .from("orders")
    .select(
      "amount, status, buyer_email, product_id, source, created_at, products!orders_product_id_fkey(name), pages(title)",
    )
    .eq("seller_user_id", ctx.ownerId)
    .gte("created_at", since)
    .limit(20000);

  const orders = (raw ?? []) as unknown as OrderLite[];

  const isPaid = (s: string) => s === "paid" || s === "partially_refunded";
  const isRefunded = (s: string) => s === "refunded" || s === "partially_refunded";

  const paid = orders.filter((o) => isPaid(o.status));
  const refunded = orders.filter((o) => o.status === "refunded");
  const failed = orders.filter((o) => o.status === "failed");

  const revenue = paid.reduce((a, o) => a + Number(o.amount || 0), 0);
  const paidCount = paid.length;
  const aov = paidCount ? revenue / paidCount : 0;
  const refundRate = paidCount + refunded.length
    ? (refunded.length / (paidCount + refunded.length)) * 100
    : 0;
  const conversion = paidCount + failed.length
    ? (paidCount / (paidCount + failed.length)) * 100
    : 0;
  const uniqueBuyers = new Set(paid.map((o) => o.buyer_email?.toLowerCase())).size;

  // Top products / pages by paid revenue.
  const byName = new Map<string, { revenue: number; orders: number }>();
  for (const o of paid) {
    const product = Array.isArray(o.products) ? o.products[0] : o.products;
    const page = Array.isArray(o.pages) ? o.pages[0] : o.pages;
    const name = product?.name ?? page?.title ?? "Other";
    const cur = byName.get(name) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(o.amount || 0);
    cur.orders += 1;
    byName.set(name, cur);
  }
  const top = [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const topMax = top[0]?.revenue || 1;

  // Revenue trend over the window (daily / weekly / monthly buckets).
  const trend = buildTrend(paid, days);
  const trendMax = Math.max(1, ...trend.map((t) => t.revenue));
  const bestDay = trend.reduce((m, t) => (t.revenue > m.revenue ? t : m), trend[0] ?? { label: "—", revenue: 0 });

  // Revenue by source (direct / order bump / one-time offer / affiliate / cart).
  const bySource = new Map<string, number>();
  for (const o of paid) {
    const s = o.source ?? "direct";
    bySource.set(s, (bySource.get(s) ?? 0) + Number(o.amount || 0));
  }
  const sources = [...bySource.entries()]
    .map(([key, rev]) => ({ label: SOURCE_LABELS[key] ?? key, revenue: rev }))
    .sort((a, b) => b.revenue - a.revenue);
  const sourceMax = Math.max(1, ...sources.map((s) => s.revenue));

  // Repeat buyers — buyers with ≥2 paid orders in this window.
  const buyerCounts = new Map<string, number>();
  for (const o of paid) {
    const e = o.buyer_email?.toLowerCase();
    if (e) buyerCounts.set(e, (buyerCounts.get(e) ?? 0) + 1);
  }
  const repeatBuyers = [...buyerCounts.values()].filter((c) => c >= 2).length;
  const repeatRate = uniqueBuyers ? (repeatBuyers / uniqueBuyers) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Insights"
        blurb="Your sales at a glance — revenue, average order value, refunds, and what's selling."
        resourcesHref={null}
      >
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map((w) => (
            <Link
              key={w.days}
              href={`/dashboard/insights?days=${w.days}`}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition " +
                (w.days === days
                  ? "bg-primary text-primary-foreground ring-primary/40"
                  : "bg-muted text-muted-foreground ring-border hover:bg-muted/70")
              }
            >
              {w.label}
            </Link>
          ))}
        </div>
      </DashboardHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Revenue (paid)" value={rupees(revenue)} icon={IndianRupee} accentColor="emerald" />
        <MetricCard label="Paid orders" value={paidCount.toLocaleString("en-IN")} icon={ShoppingBag} accentColor="indigo" />
        <MetricCard label="Avg order value" value={rupees(aov)} icon={TrendingUp} accentColor="violet" />
        <MetricCard label="Paid conversion" value={`${conversion.toFixed(1)}%`} icon={Percent} accentColor="indigo" />
        <MetricCard label="Refund rate" value={`${refundRate.toFixed(1)}%`} icon={Undo2} accentColor="amber" />
        <MetricCard label="Unique buyers" value={uniqueBuyers.toLocaleString("en-IN")} icon={Users} accentColor="rose" />
        <MetricCard label="Repeat buyers" value={`${repeatBuyers.toLocaleString("en-IN")} · ${repeatRate.toFixed(0)}%`} icon={Repeat} accentColor="emerald" />
      </div>

      {/* Revenue trend over the window */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Revenue trend
          </h2>
          {bestDay && bestDay.revenue > 0 && (
            <span className="text-xs text-muted-foreground">
              Best: <span className="font-medium text-foreground">{rupees(bestDay.revenue)}</span> ({bestDay.label})
            </span>
          )}
        </div>
        {revenue === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No revenue in this window"
            description="Your revenue trend will plot here as sales come in."
          />
        ) : (
          <div className="flex h-40 items-end gap-1">
            {trend.map((t, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                  style={{ height: `${Math.max(2, (t.revenue / trendMax) * 100)}%` }}
                  title={`${t.label}: ${rupees(t.revenue)}`}
                />
                <span className="truncate text-[9px] text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Top products</h2>
        {top.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No sales in this window"
            description="Once you make sales, your best-selling products will rank here."
          />
        ) : (
          <div className="space-y-3">
            {top.map((t) => (
              <div key={t.name}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{t.name}</span>
                  <span className="shrink-0 font-medium text-foreground">
                    {rupees(t.revenue)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.orders} order{t.orders === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (t.revenue / topMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue by source */}
      {sources.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Revenue by source</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Where your paid revenue comes from — direct checkouts vs order bumps, one-time offers and affiliates.
          </p>
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{s.label}</span>
                  <span className="shrink-0 font-medium text-foreground">
                    {rupees(s.revenue)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {revenue ? ((s.revenue / revenue) * 100).toFixed(0) : 0}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(4, (s.revenue / sourceMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
