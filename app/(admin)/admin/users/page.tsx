import { UsersTable, type AdminUserRow } from "@/components/admin/UsersTable";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, subscription_plan, subscription_status, kyc_level, is_admin, suspended_at, total_revenue, created_at",
    )
    .order("created_at", { ascending: false });

  const users: AdminUserRow[] = (data ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    subscription_plan: u.subscription_plan ?? "free",
    subscription_status: u.subscription_status ?? "inactive",
    kyc_level: Number(u.kyc_level ?? 0),
    is_admin: !!u.is_admin,
    suspended: !!u.suspended_at,
    total_revenue: Number(u.total_revenue ?? 0),
    created_at: u.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Every seller on the platform.
        </p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
