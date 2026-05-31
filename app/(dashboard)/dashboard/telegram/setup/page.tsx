import { redirect } from "next/navigation";

import { ConnectFlow } from "@/components/dashboard/telegram/ConnectFlow";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Connect Telegram" };

export default async function TelegramSetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const commissionPercent = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 5);

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
