// Admin · InvoxAI-TR (Session 16) — InvoxAI's OWN transaction register: the
// seller-wallet ledger. Debits are platform fees (InvoxAI revenue); credits are
// seller wallet recharges (cash collected). Read-only; latest 2k movements.

import {
  AdminRevenueClient,
  type AdminRevenueRow,
} from "@/components/admin/AdminRevenueClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · InvoxAI-TR" };

export default async function AdminInvoxaiTrPage() {
  const admin = createAdminClient();
  const { data: txns } = await admin
    .from("wallet_transactions")
    .select("id, type, amount_paise, order_id, description, balance_after, created_at, seller_user_id")
    .order("created_at", { ascending: false })
    .limit(2000);

  const sellerIds = [
    ...new Set((txns ?? []).map((t) => t.seller_user_id as string).filter(Boolean)),
  ];
  const nameById = new Map<string, string>();
  if (sellerIds.length) {
    const { data: sellers } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", sellerIds);
    for (const s of sellers ?? []) {
      nameById.set(s.id as string, (s.full_name as string) || (s.email as string) || "—");
    }
  }

  const rows: AdminRevenueRow[] = (txns ?? []).map((t) => ({
    id: t.id as string,
    type: (t.type as string) === "credit" ? "credit" : "debit",
    amountPaise: Number(t.amount_paise ?? 0),
    orderId: (t.order_id as string) ?? null,
    description: (t.description as string) ?? null,
    balanceAfterPaise: Number(t.balance_after ?? 0),
    createdAt: t.created_at as string,
    sellerUserId: (t.seller_user_id as string) ?? "",
    sellerName: nameById.get(t.seller_user_id as string) ?? "—",
  }));

  // Lifetime totals (across the loaded window).
  const fees = rows.filter((r) => r.type === "debit").reduce((a, r) => a + r.amountPaise, 0);
  const recharged = rows.filter((r) => r.type === "credit").reduce((a, r) => a + r.amountPaise, 0);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="InvoxAI-TR"
        blurb="InvoxAI's transaction register — platform fees earned and wallet recharges collected (latest 2k movements)."
        resourcesHref={null}
      >
        <div className="text-right text-sm text-foreground">
          <div>
            Fees earned <span className="ml-2 font-mono">{formatINR(fees)}</span>
          </div>
          <div className="text-muted-foreground">
            Recharged <span className="ml-2 font-mono">{formatINR(recharged)}</span>
          </div>
        </div>
      </DashboardHero>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminRevenueClient rows={rows} />
      </div>
    </div>
  );
}
