import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GatewaySettingsForm,
  type ExistingGateway,
} from "@/components/dashboard/GatewaySettingsForm";
import { liveGateways } from "@/lib/gateways";

export const metadata = { title: "Payment Gateway · Settings" };

export default async function GatewaySettingsPage() {
  const ctx = await requirePageActor("gateway.view", "/dashboard/settings/gateway");

  const admin = createAdminClient();
  // Only non-secret status fields — the encrypted keys never leave the server.
  // A seller can connect several gateways and switch the active one.
  const { data: gateways } = await admin
    .from("seller_gateway_config")
    .select("gateway_type, is_active, is_verified")
    .eq("seller_user_id", ctx.ownerId)
    .order("gateway_type");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Payment Gateway
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your own Razorpay account. Buyer payments go directly to you
          — InvoxAI deducts a small platform fee from your wallet per order.
          (More gateways coming soon.)
        </p>
      </div>

      <GatewaySettingsForm
        gateways={(gateways ?? []) as ExistingGateway[]}
        liveGateways={liveGateways()}
      />

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Webhook setup (recommended)</p>
        <p className="mt-1 text-muted-foreground">
          In your Razorpay dashboard → Settings → Webhooks, add this URL with the{" "}
          <code className="rounded bg-background px-1">payment.captured</code> event, and
          set the webhook secret to the same value you entered above. This confirms
          orders even if a buyer closes the tab right after paying.
        </p>
        <code className="mt-2 block break-all rounded bg-background px-2 py-1 text-xs">
          {process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io"}
          /api/webhooks/razorpay/seller
        </code>
      </div>
    </div>
  );
}
