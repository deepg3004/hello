import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  AdminWalletsClient,
  type AdminWalletRow,
  type AdminWalletTxn,
  type WalletFeeSummary,
} from "@/components/admin/AdminWalletsClient";

export const metadata = { title: "Admin · Seller Wallets" };

type ProfileRel = { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
const pickProfile = (p: ProfileRel) => (Array.isArray(p) ? p[0] : p);

export default async function AdminSellerWalletsPage() {
  const admin = createAdminClient();

  const [{ data: summaryRows }, { data: walletsRaw }, { data: txnsRaw }] =
    await Promise.all([
      admin.rpc("admin_wallet_fee_summary"),
      admin
        .from("seller_wallets")
        .select(
          "seller_user_id, balance_paise, last_low_balance_alert_at, user_profiles!seller_wallets_seller_user_id_fkey(full_name, email)",
        )
        .order("balance_paise", { ascending: true })
        .limit(1000),
      admin
        .from("wallet_transactions")
        .select(
          "id, seller_user_id, type, amount_paise, description, balance_after, created_at, user_profiles!wallet_transactions_seller_user_id_fkey(full_name, email)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const s = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;
  const summary: WalletFeeSummary = {
    totalFeesPaise: Number(s?.total_fees_paise ?? 0),
    monthFeesPaise: Number(s?.month_fees_paise ?? 0),
    lowBalanceSellers: Number(s?.low_balance_sellers ?? 0),
  };

  const wallets: AdminWalletRow[] = (walletsRaw ?? []).map((w) => {
    const p = pickProfile(w.user_profiles as ProfileRel);
    return {
      sellerUserId: w.seller_user_id,
      sellerName: p?.full_name ?? p?.email ?? "—",
      sellerEmail: p?.email ?? "",
      balancePaise: Number(w.balance_paise ?? 0),
      lastLowBalanceAlertAt: w.last_low_balance_alert_at ?? null,
    };
  });

  const recentTxns: AdminWalletTxn[] = (txnsRaw ?? []).map((t) => {
    const p = pickProfile(t.user_profiles as ProfileRel);
    return {
      id: t.id,
      sellerName: p?.full_name ?? p?.email ?? "—",
      type: t.type as "credit" | "debit",
      amountPaise: Number(t.amount_paise ?? 0),
      description: t.description,
      balanceAfter: Number(t.balance_after ?? 0),
      createdAt: t.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <div className="animate-in-up" style={{ animationDelay: "0ms" }}>
        <DashboardHero
          title="Seller Wallets"
          blurb={`${wallets.length.toLocaleString("en-IN")} wallets · platform fees collected per order.`}
          resourcesHref={null}
        />
      </div>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminWalletsClient
          summary={summary}
          wallets={wallets}
          recentTxns={recentTxns}
        />
      </div>
    </div>
  );
}
