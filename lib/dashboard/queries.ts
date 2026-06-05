// Server-side aggregations for the seller dashboard. All queries are scoped
// to a single user_id and use the admin client to bypass RLS — calling code
// is responsible for verifying the caller owns that user_id (typically by
// reading auth.uid() from the session).

import { startOfMonth, subMonths, subHours } from "date-fns";

import { createAdminClient } from "@/lib/supabase/admin";

export interface DashboardMetrics {
  revenueThisMonth: number;
  /** Revenue captured Jan 1–31 of the previous calendar month. Drives the
   *  "vs ₹X last month" hint on the Revenue MetricCard. */
  revenueLastMonth: number;
  totalCustomers: number;
  activePages: number;
  failedPayments: number;
  /** Failed orders in the last 24 hours — feeds the rolling-window
   *  "Failed Payments" metric card. */
  failedLast24h: number;
  commissionPaid: number;
}

export async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const lastMonthEnd = startOfMonth(now).toISOString();
  const dayAgo = subHours(now, 24).toISOString();

  const [
    { data: revenueRows },
    { data: lastMonthRevenueRows },
    { data: paidOrders },
    { count: pagesCount },
    { count: failedCount },
    { count: failedLast24hCount },
    { data: commissionRows },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("amount")
      .eq("seller_user_id", userId)
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    // Last calendar month — used for the "vs ₹X last month" trend hint.
    admin
      .from("orders")
      .select("amount")
      .eq("seller_user_id", userId)
      .eq("status", "paid")
      .gte("paid_at", lastMonthStart)
      .lt("paid_at", lastMonthEnd),
    admin
      .from("orders")
      .select("buyer_email")
      .eq("seller_user_id", userId)
      .eq("status", "paid"),
    admin
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "published"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", userId)
      .eq("status", "failed"),
    // Rolling 24-hour failed-orders count — drives the at-a-glance card on
    // the overview page. Index on orders(created_at) keeps this cheap.
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", userId)
      .eq("status", "failed")
      .gte("created_at", dayAgo),
    admin
      .from("orders")
      .select("platform_commission")
      .eq("seller_user_id", userId)
      .eq("status", "paid"),
  ]);

  const revenueThisMonth = (revenueRows ?? []).reduce(
    (acc, r) => acc + Number(r.amount ?? 0),
    0,
  );

  const revenueLastMonth = (lastMonthRevenueRows ?? []).reduce(
    (acc, r) => acc + Number(r.amount ?? 0),
    0,
  );

  const uniqueCustomers = new Set(
    (paidOrders ?? []).map((r) => r.buyer_email?.toLowerCase()).filter(Boolean),
  ).size;

  const commissionPaid = (commissionRows ?? []).reduce(
    (acc, r) => acc + Number(r.platform_commission ?? 0),
    0,
  );

  return {
    revenueThisMonth,
    revenueLastMonth,
    totalCustomers: uniqueCustomers,
    activePages: pagesCount ?? 0,
    failedPayments: failedCount ?? 0,
    failedLast24h: failedLast24hCount ?? 0,
    commissionPaid,
  };
}

export interface RecentTransactionRow {
  id: string;
  buyer_name: string | null;
  buyer_email: string;
  amount: number;
  status: string;
  page_title: string | null;
  created_at: string;
}

export async function getRecentTransactions(
  userId: string,
  limit = 10,
): Promise<RecentTransactionRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id, buyer_name, buyer_email, amount, status, created_at, pages(title)")
    .eq("seller_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as Array<{
    id: string;
    buyer_name: string | null;
    buyer_email: string;
    amount: number;
    status: string;
    created_at: string;
    pages: { title: string } | { title: string }[] | null;
  }>).map((row) => ({
    id: row.id,
    buyer_name: row.buyer_name,
    buyer_email: row.buyer_email,
    amount: Number(row.amount ?? 0),
    status: row.status,
    page_title: Array.isArray(row.pages) ? row.pages[0]?.title ?? null : row.pages?.title ?? null,
    created_at: row.created_at,
  }));
}

export interface TopPageRow {
  id: string;
  title: string;
  slug: string;
  type: string | null;
  template_id: string | null;
  total_revenue: number;
}

export async function getTopPages(userId: string, limit = 5): Promise<TopPageRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select("id, title, slug, type, template_id, total_revenue")
    .eq("user_id", userId)
    .order("total_revenue", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    type: (r as { type?: string | null }).type ?? null,
    template_id: (r as { template_id?: string | null }).template_id ?? null,
    total_revenue: Number(r.total_revenue ?? 0),
  }));
}
