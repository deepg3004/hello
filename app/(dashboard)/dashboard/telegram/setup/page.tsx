import { redirect } from "next/navigation";

import { ConnectFlow } from "@/components/dashboard/telegram/ConnectFlow";
import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCommissionPercent, type PlanKey } from "@/lib/plans";
import { getCommissionConfig } from "@/lib/settings";

export const metadata = { title: "Connect Telegram" };

export default async function TelegramSetupPage() {
  const ctx = await requirePageActor("telegram.view", "/dashboard/telegram");

  // Show the seller their plan-accurate commission, resolved through the same
  // admin settings the checkout routes use — not a hardcoded env default.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subscription_plan")
    .eq("id", ctx.ownerId)
    .single();
  const { defaultPercent, perPlan } = await getCommissionConfig();
  const commissionPercent = resolveCommissionPercent(
    (profile?.subscription_plan ?? "free") as PlanKey,
    defaultPercent,
    perPlan,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Connect Telegram
        </h1>
        <p className="text-sm text-muted-foreground">
          Log in with Telegram, pick a channel, set your plans, and publish a
          paid subscription page — in a few steps.
        </p>
      </div>
      <ConnectFlow commissionPercent={commissionPercent} />
    </div>
  );
}
