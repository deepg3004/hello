import {
  AdminCouponsClient,
  type AdminCouponRow,
} from "@/components/admin/AdminCouponsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Coupons" };
export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const admin = createAdminClient();
  const { data: raw } = await admin
    .from("coupons")
    .select(
      "id, code, discount_type, discount_value, total_limit, usage_count, expires_at, active, page_ids, user_id, user_profiles!coupons_user_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  type Row = {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    total_limit: number | null;
    usage_count: number | null;
    expires_at: string | null;
    active: boolean | null;
    page_ids: string[] | null;
    user_profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
  };
  const rows: AdminCouponRow[] = ((raw ?? []) as unknown as Row[]).map((r) => {
    const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
    return {
      id: r.id,
      code: r.code,
      discount_type: r.discount_type,
      discount_value: Number(r.discount_value ?? 0),
      total_limit: r.total_limit,
      usage_count: Number(r.usage_count ?? 0),
      expires_at: r.expires_at,
      active: r.active ?? true,
      page_scoped: !!(r.page_ids && r.page_ids.length > 0),
      seller_name: seller?.full_name ?? seller?.email ?? "—",
      seller_email: seller?.email ?? "—",
    };
  });

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Coupons"
        blurb="Every seller's discount codes. Disable abusive or mistaken codes — changes are audit-logged."
        resourcesHref={null}
      >
        <div className="text-right text-sm text-foreground">
          <div>
            {activeCount} active
            <span className="ml-2 text-muted-foreground">/ {rows.length} total</span>
          </div>
        </div>
      </DashboardHero>

      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminCouponsClient rows={rows} />
      </div>
    </div>
  );
}
