import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WalletBalanceCard } from "@/components/dashboard/WalletBalanceCard";
import {
  WalletTransactionList,
  type WalletTxRow,
} from "@/components/dashboard/WalletTransactionList";
import { WalletRechargePanel } from "@/components/dashboard/WalletRechargePanel";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/wallet");

  const admin = createAdminClient();
  const [{ data: wallet }, { data: transactions }] = await Promise.all([
    admin
      .from("seller_wallets")
      .select("balance_paise, auto_recharge_enabled")
      .eq("seller_user_id", user.id)
      .maybeSingle(),
    admin
      .from("wallet_transactions")
      .select(
        "id, type, amount_paise, description, balance_after, created_at, order_id",
      )
      .eq("seller_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Platform fees are deducted per completed order. Recharge to keep your
          store active.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <WalletBalanceCard
          balancePaise={Number(wallet?.balance_paise ?? 0)}
          autoRechargeEnabled={wallet?.auto_recharge_enabled ?? false}
        />
      </div>

      <WalletRechargePanel />

      <WalletTransactionList
        transactions={(transactions ?? []) as WalletTxRow[]}
      />
    </div>
  );
}
