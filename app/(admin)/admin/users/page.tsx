import { UsersTable, type AdminUserRow } from "@/components/admin/UsersTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  const admin = createAdminClient();
  const [{ data }, { data: wallets }] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "id, full_name, email, phone, subscription_plan, subscription_status, is_admin, suspended_at, total_revenue, created_at",
      )
      .order("created_at", { ascending: false }),
    admin.from("seller_wallets").select("seller_user_id, balance_paise"),
  ]);

  const balanceBySeller = new Map<string, number>(
    (wallets ?? []).map((w) => [w.seller_user_id, Number(w.balance_paise ?? 0)]),
  );

  const users: AdminUserRow[] = (data ?? []).map((u) => ({
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

  return (
    <div className="space-y-6">
      <div
        className="animate-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <DashboardHero
          title="Users"
          blurb={`${users.length.toLocaleString("en-IN")} sellers on the platform.`}
          resourcesHref={null}
        />
      </div>
      <div
        className="animate-in-up"
        style={{ animationDelay: "100ms" }}
      >
        <UsersTable users={users} />
      </div>
    </div>
  );
}
