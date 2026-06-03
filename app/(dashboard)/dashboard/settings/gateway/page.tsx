import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GatewaySettingsForm,
  type ExistingGateway,
} from "@/components/dashboard/GatewaySettingsForm";

export const metadata = { title: "Payment Gateway · Settings" };

export default async function GatewaySettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings/gateway");

  const admin = createAdminClient();
  // Only non-secret status fields — the encrypted keys never leave the server.
  const { data: existing } = await admin
    .from("seller_gateway_config")
    .select("gateway_type, is_active, is_verified")
    .eq("seller_user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Payment Gateway
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your own Razorpay or Cashfree account. Buyer payments go
          directly to you — InvoxAI deducts a small platform fee from your
          wallet per order.
        </p>
      </div>

      <GatewaySettingsForm existing={(existing ?? null) as ExistingGateway | null} />
    </div>
  );
}
