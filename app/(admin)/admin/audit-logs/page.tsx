import {
  AdminAuditLogsClient,
  type AuditLogRow,
} from "@/components/admin/AdminAuditLogsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Audit Logs" };

interface AuditRow {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}

export default async function AdminAuditLogsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_audit_logs")
    .select(
      "id, admin_id, action, target_type, target_id, details, ip_address, created_at, user_profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as AuditRow[];

  const clientRows: AuditLogRow[] = rows.map((r) => {
    const adminP = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
    return {
      id: r.id,
      admin_id: r.admin_id,
      admin_name:
        adminP?.full_name ?? adminP?.email ?? (r.admin_id ? r.admin_id.slice(0, 8) : "system"),
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      ip_address: r.ip_address,
      details: r.details ? JSON.stringify(r.details) : null,
      created_at: r.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <DashboardHero
          title="Audit log"
          blurb="Every admin action is recorded here."
          resourcesHref={null}
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "60ms" }}>
        <AdminAuditLogsClient rows={clientRows} />
      </div>
    </div>
  );
}
