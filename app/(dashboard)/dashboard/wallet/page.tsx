import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeeConfig } from "@/lib/settings";
import { effectivePlanRule, describeFeeRule } from "@/lib/fees";
import { PLANS, type PlanKey } from "@/lib/plans";
import { formatINR } from "@/lib/utils";
import { WalletBalanceCard } from "@/components/dashboard/WalletBalanceCard";
import {
  WalletTransactionList,
  type WalletTxRow,
} from "@/components/dashboard/WalletTransactionList";
import { WalletRechargePanel } from "@/components/dashboard/WalletRechargePanel";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const ctx = await requirePageActor("wallet.view", "/dashboard/wallet");

  const admin = createAdminClient();
  const [{ data: wallet }, { data: transactions }, { data: profile }, feeConfig] =
    await Promise.all([
      admin
        .from("seller_wallets")
        .select("balance_paise, auto_recharge_enabled")
        .eq("seller_user_id", ctx.ownerId)
        .maybeSingle(),
      admin
        .from("wallet_transactions")
        .select(
          "id, type, amount_paise, description, balance_after, created_at, order_id",
        )
        .eq("seller_user_id", ctx.ownerId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("user_profiles")
        .select("subscription_plan")
        .eq("id", ctx.ownerId)
        .single(),
      getFeeConfig(),
    ]);

  // Effective per-order platform fee for this seller's plan (admin-configurable;
  // re-read every request so admin changes appear automatically).
  const plan = (profile?.subscription_plan ?? "free") as PlanKey;
  const feeText = describeFeeRule(
    effectivePlanRule(plan, feeConfig, PLANS[plan].wallet_fee_paise),
    formatINR,
  );
  // GST is added on top of the platform fee and debited together with it.
  const gstNote =
    feeConfig.gstPercent > 0 ? ` + ${feeConfig.gstPercent}% GST` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Platform fees are deducted per completed order. Recharge to keep your
          store active.
        </p>
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Your plan&apos;s platform fee:</span>{" "}
          <span className="font-medium text-foreground">{feeText}{gstNote}</span>
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
