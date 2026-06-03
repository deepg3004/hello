// Server-side data for the per-category Pages dashboards. Scoped to a single
// user_id via the admin client — callers must verify ownership (auth.uid()).

import { subDays } from "date-fns";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PageCardData } from "@/components/dashboard/PageCard";
import {
  pageMatchesCategory,
  type PageCategoryKey,
} from "@/lib/dashboard/page-categories";

/** A page row plus a display-ready price label derived from its products. */
export interface DashboardPageRow extends PageCardData {
  /** "₹4,999" / "From ₹4,999" / "—" when the page has no active product. */
  priceLabel: string;
}

export interface CategorySpark {
  /** ISO day (yyyy-mm-dd). */
  d: string;
  revenue: number;
  sales: number;
}

export interface CategoryStats {
  totalSales: number;
  /** All-time revenue in rupees. */
  totalRevenue: number;
  conversionPct: number;
  /** Last-7-days vs previous-7-days % change (null when no prior data). */
  salesTrendPct: number | null;
  revenueTrendPct: number | null;
  /** 14-day daily series for the sparklines. */
  spark: CategorySpark[];
}

export interface CategoryDashboardData {
  pages: DashboardPageRow[];
  stats: CategoryStats;
}

const SPARK_DAYS = 14;

function trendPct(last: number, prev: number): number | null {
  if (prev <= 0) return last > 0 ? 100 : null;
  return Math.round(((last - prev) / prev) * 100);
}

function priceLabel(prices: number[]): string {
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const fmt = `₹${Math.round(min).toLocaleString("en-IN")}`;
  return prices.length > 1 ? `From ${fmt}` : fmt;
}

export async function getCategoryDashboard(
  userId: string,
  category: PageCategoryKey,
): Promise<CategoryDashboardData> {
  const admin = createAdminClient();

  const { data: pagesRaw } = await admin
    .from("pages")
    .select(
      "id, title, slug, type, status, template_id, thumbnail_url, view_count, conversion_count, total_revenue, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Keep only the pages that belong to this category.
  const matched = (pagesRaw ?? []).filter((p) =>
    pageMatchesCategory(
      { type: p.type as string, template_id: p.template_id ?? null },
      category,
    ),
  );
  const pageIds = matched.map((p) => p.id);

  // Per-page prices (lowest active product) + per-page order history run in
  // parallel; both are no-ops when the category has no pages.
  const sinceSpark = subDays(new Date(), SPARK_DAYS).toISOString();
  const [{ data: productRows }, { data: orderRows }] = await Promise.all([
    pageIds.length
      ? admin
          .from("products")
          .select("page_id, price")
          .in("page_id", pageIds)
          .eq("active", true)
      : Promise.resolve({ data: [] as { page_id: string; price: number }[] }),
    pageIds.length
      ? admin
          .from("orders")
          .select("page_id, amount, created_at")
          .in("page_id", pageIds)
          .eq("seller_user_id", userId)
          .eq("status", "paid")
          .gte("created_at", sinceSpark)
      : Promise.resolve({
          data: [] as { page_id: string; amount: number; created_at: string }[],
        }),
  ]);

  // Group prices by page for the table's PRICE column.
  const pricesByPage = new Map<string, number[]>();
  for (const r of productRows ?? []) {
    const list = pricesByPage.get(r.page_id) ?? [];
    list.push(Number(r.price ?? 0));
    pricesByPage.set(r.page_id, list);
  }

  const pages: DashboardPageRow[] = matched.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    type: p.type as PageCardData["type"],
    status: p.status as PageCardData["status"],
    template_id: p.template_id ?? "course",
    thumbnail_url: p.thumbnail_url,
    view_count: Number(p.view_count ?? 0),
    conversion_count: Number(p.conversion_count ?? 0),
    total_revenue: Number(p.total_revenue ?? 0),
    created_at: p.created_at,
    priceLabel: priceLabel(pricesByPage.get(p.id) ?? []),
  }));

  // ── All-time headline totals (from the page aggregates) ──────────────
  const totalRevenue = pages.reduce((a, p) => a + p.total_revenue, 0);
  const totalSales = pages.reduce((a, p) => a + p.conversion_count, 0);
  const totalViews = pages.reduce((a, p) => a + p.view_count, 0);
  const conversionPct =
    totalViews > 0 ? Math.round((totalSales / totalViews) * 1000) / 10 : 0;

  // ── 14-day sparkline + 7d-vs-prior-7d trend (from paid orders) ───────
  const buckets: Record<string, { revenue: number; sales: number }> = {};
  const days: string[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const key = subDays(new Date(), i).toISOString().slice(0, 10);
    days.push(key);
    buckets[key] = { revenue: 0, sales: 0 };
  }
  for (const o of orderRows ?? []) {
    const key = String(o.created_at).slice(0, 10);
    const b = buckets[key];
    if (b) {
      b.revenue += Number(o.amount ?? 0);
      b.sales += 1;
    }
  }
  const spark: CategorySpark[] = days.map((d) => ({
    d,
    revenue: buckets[d]!.revenue,
    sales: buckets[d]!.sales,
  }));

  const last7 = spark.slice(7);
  const prev7 = spark.slice(0, 7);
  const sum = (rows: CategorySpark[], k: "revenue" | "sales") =>
    rows.reduce((a, r) => a + r[k], 0);

  return {
    pages,
    stats: {
      totalSales,
      totalRevenue,
      conversionPct,
      salesTrendPct: trendPct(sum(last7, "sales"), sum(prev7, "sales")),
      revenueTrendPct: trendPct(sum(last7, "revenue"), sum(prev7, "revenue")),
      spark,
    },
  };
}
