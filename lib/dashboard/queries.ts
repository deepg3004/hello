// Server-side aggregations for the seller dashboard. All queries are scoped
// to a single user_id and use the admin client to bypass RLS — calling code
// is responsible for verifying the caller owns that user_id (typically by
// reading auth.uid() from the session).

import { startOfMonth } from "date-fns";

import { createAdminClient } from "@/lib/supabase/admin";

export interface DashboardMetrics {
  revenueThisMonth: number;
  pendingPayout: number;
  totalCustomers: number;
  activePages: number;
  failedPayments: number;
  commissionPaid: number;
}

export async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const admin = createAdminClient();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [{ data: revenueRows }, { data: pendingRows }, { data: paidOrders }, { count: pagesCount }, { count: failedCount }, { data: commissionRows }] = await Promise.all([
    admin
      .from("orders")
      .select("amount")
      .eq("seller_user_id", userId)
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    admin
      .from("orders")
      .select("seller_amount")
      .eq("seller_user_id", userId)
      .eq("status", "paid"),
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

  // Pending payout = all-time paid seller amounts MINUS amounts already in
  // completed payouts. Subtract by querying payouts separately.
  const grossPayable = (pendingRows ?? []).reduce(
    (acc, r) => acc + Number(r.seller_amount ?? 0),
    0,
  );
  const { data: completedPayouts } = await admin
    .from("payouts")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "completed");
  const paidOut = (completedPayouts ?? []).reduce(
    (acc, r) => acc + Number(r.amount ?? 0),
    0,
  );
  const pendingPayout = Math.max(0, grossPayable - paidOut);

  const uniqueCustomers = new Set(
    (paidOrders ?? []).map((r) => r.buyer_email?.toLowerCase()).filter(Boolean),
  ).size;

  const commissionPaid = (commissionRows ?? []).reduce(
    (acc, r) => acc + Number(r.platform_commission ?? 0),
    0,
  );

  return {
    revenueThisMonth,
    pendingPayout,
    totalCustomers: uniqueCustomers,
    activePages: pagesCount ?? 0,
    failedPayments: failedCount ?? 0,
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
  total_revenue: number;
}

export async function getTopPages(userId: string, limit = 5): Promise<TopPageRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select("id, title, slug, total_revenue")
    .eq("user_id", userId)
    .order("total_revenue", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    total_revenue: Number(r.total_revenue ?? 0),
  }));
}
