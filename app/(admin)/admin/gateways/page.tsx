import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  AdminGatewaysClient,
  type AdminGatewayRow,
} from "@/components/admin/AdminGatewaysClient";

export const metadata = { title: "Admin · Gateways" };

type ProfileRel =
  | { full_name: string | null; email: string }
  | { full_name: string | null; email: string }[]
  | null;
const pickProfile = (p: ProfileRel) => (Array.isArray(p) ? p[0] : p);

export default async function AdminGatewaysPage() {
  const admin = createAdminClient();
  // NOTE: never select the *_enc secret columns.
  const { data: raw } = await admin
    .from("seller_gateway_config")
    .select(
      "seller_user_id, gateway_type, is_active, is_verified, created_at, user_profiles!seller_gateway_config_seller_user_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows: AdminGatewayRow[] = (raw ?? []).map((g) => {
    const p = pickProfile(g.user_profiles as ProfileRel);
    return {
      sellerUserId: g.seller_user_id,
      sellerName: p?.full_name ?? p?.email ?? "—",
      sellerEmail: p?.email ?? "",
      gatewayType: g.gateway_type,
      isActive: !!g.is_active,
      isVerified: !!g.is_verified,
      createdAt: g.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <div className="animate-in-up" style={{ animationDelay: "0ms" }}>
        <DashboardHero
          title="Gateway Connections"
          blurb={`${rows.length.toLocaleString("en-IN")} sellers have connected a payment gateway.`}
          resourcesHref={null}
        />
      </div>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminGatewaysClient rows={rows} />
      </div>
    </div>
  );
}
