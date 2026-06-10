import { UsersTable, type AdminUserRow } from "@/components/admin/UsersTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Users" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const COLS =
  "id, full_name, email, phone, subscription_plan, subscription_status, is_admin, suspended_at, total_revenue, created_at";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Strip characters that have meaning in PostgREST's `or()` filter DSL so a
 *  search term can't break (or inject into) the query string. */
const safeTerm = (q: string) => q.replace(/[,()*%:\\]/g, "").trim();

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const admin = createAdminClient();

  const page = Math.max(1, Number(str(searchParams.page)) || 1);
  const q = safeTerm(str(searchParams.q));
  const plan = str(searchParams.plan) || "all";
  const status = str(searchParams.status) || "all";
  const from = str(searchParams.from);
  const to = str(searchParams.to);
  const sort = str(searchParams.sort) || "joined";

  // ── Paged, filtered query (executed in the DB, not in memory) ──────────
  let query = admin.from("user_profiles").select(COLS, { count: "exact" });
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (plan !== "all") query = query.eq("subscription_plan", plan);
  if (status === "suspended") query = query.not("suspended_at", "is", null);
  if (status === "active") query = query.is("suspended_at", null);
  if (from) query = query.gte("created_at", from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }
  if (sort === "revenue") query = query.order("total_revenue", { ascending: false });
  else if (sort === "name") query = query.order("full_name", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = data ?? [];

  // Wallet balances only for the visible page.
  const ids = rows.map((u) => u.id as string);
  const { data: wallets } = ids.length
    ? await admin
        .from("seller_wallets")
        .select("seller_user_id, balance_paise")
        .in("seller_user_id", ids)
    : { data: [] as { seller_user_id: string; balance_paise: number }[] };
  const balanceBySeller = new Map<string, number>(
    (wallets ?? []).map((w) => [w.seller_user_id, Number(w.balance_paise ?? 0)]),
  );

  const users: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    subscription_plan: u.subscription_plan ?? "free",
    subscription_status: u.subscription_status ?? "inactive",
    is_admin: !!u.is_admin,
    suspended: !!u.suspended_at,
    total_revenue: Number(u.total_revenue ?? 0),
    wallet_balance_paise: balanceBySeller.get(u.id) ?? 0,
    created_at: u.created_at,
  }));

  // ── Platform-wide summary (cheap COUNT queries — O(1) regardless of size) ─
  const head = () => admin.from("user_profiles").select("id", { count: "exact", head: true });
  // Lifetime revenue via a single DB aggregate; tolerant if aggregates are off.
  async function lifetimeRevenue(): Promise<number | null> {
    try {
      const { data, error } = await admin.from("user_profiles").select("total_revenue.sum()");
      const row = (data as { sum?: number }[] | null)?.[0];
      if (error || !row) return null;
      return Number(row.sum ?? 0);
    } catch {
      return null;
    }
  }

  const [totalRes, suspendedRes, payingRes, revenue] = await Promise.all([
    head(),
    head().not("suspended_at", "is", null),
    head()
      .neq("subscription_plan", "free")
      .in("subscription_status", ["active", "trialing"])
      .is("suspended_at", null),
    lifetimeRevenue(),
  ]);

  const stats = {
    total: totalRes.count ?? 0,
    suspended: suspendedRes.count ?? 0,
    paying: payingRes.count ?? 0,
    revenue,
  };

  return (
    <div className="space-y-6">
      <div className="animate-in-up" style={{ animationDelay: "0ms" }}>
        <DashboardHero
          title="Users"
          blurb={`${stats.total.toLocaleString("en-IN")} sellers on the platform.`}
          resourcesHref={null}
        />
      </div>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <UsersTable
          users={users}
          stats={stats}
          total={count ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          filters={{ q: str(searchParams.q), plan, status, from, to, sort }}
        />
      </div>
    </div>
  );
}
