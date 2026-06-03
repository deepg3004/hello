import { Clock, Loader2, CheckCircle2 } from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { AdminPayoutsClient, type AdminPayoutRow } from "@/components/admin/AdminPayoutsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Payouts" };

const rupees = (n: number) => formatINR(n * 100);

export default async function AdminPayoutsPage() {
  const admin = createAdminClient();
  // payouts has 3 FKs to user_profiles (user_id + cancelled_by_admin_id +
  // approved_by_admin_id) — disambiguate so PostgREST returns the seller,
  // not the admin who approved/cancelled the payout.
  const { data: rowsRaw } = await admin
    .from("payouts")
    .select(
      "id, user_id, amount, status, gateway, bank_account, initiated_at, completed_at, failure_reason, user_profiles!payouts_user_id_fkey(full_name, email)",
    )
    .order("initiated_at", { ascending: false })
    .limit(500);

  const rows = (rowsRaw ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    amount: number;
    status: string;
    gateway: string | null;
    bank_account: string | null;
    initiated_at: string;
    completed_at: string | null;
    failure_reason: string | null;
    user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  }>;

  const queued = rows.filter((r) => r.status === "queued").reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const processing = rows.filter((r) => r.status === "processing").reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const paid = rows.filter((r) => r.status === "completed").reduce((a, r) => a + Number(r.amount ?? 0), 0);

  const clientRows: AdminPayoutRow[] = rows.map((r) => {
    const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
    return {
      id: r.id,
      user_id: r.user_id,
      amount: Number(r.amount ?? 0),
      status: r.status,
      bank_account: r.bank_account,
      initiated_at: r.initiated_at,
      completed_at: r.completed_at,
      failure_reason: r.failure_reason,
      seller_name: seller?.full_name ?? null,
      seller_email: seller?.email ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="animate-in-up" style={{ animationDelay: "0ms" }}>
        <DashboardHero
          title="Payouts"
          blurb="Every payout request across the platform."
          resourcesHref={null}
        />
      </div>

      <div
        className="grid grid-cols-2 gap-4 animate-in-up md:grid-cols-3"
        style={{ animationDelay: "60ms" }}
      >
        <MetricCard label="Queued" value={rupees(queued)} icon={Clock} accentColor="amber" />
        <MetricCard label="Processing" value={rupees(processing)} icon={Loader2} accentColor="indigo" />
        <MetricCard label="Paid out" value={rupees(paid)} icon={CheckCircle2} accentColor="emerald" />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <AdminPayoutsClient rows={clientRows} />
      </div>
    </div>
  );
}
