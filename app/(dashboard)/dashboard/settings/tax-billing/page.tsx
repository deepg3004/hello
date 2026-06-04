import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { STATE_CODES, stateNameFromCode } from "@/lib/gst";
import { TaxBillingForm } from "@/components/dashboard/TaxBillingForm";

export const metadata = { title: "Tax & Billing · Settings" };

interface GstAddress {
  line1?: string;
  line2?: string | null;
  city?: string;
  state_code?: string;
  state?: string;
  pincode?: string;
}

export default async function TaxBillingPage() {
  const ctx = await requirePageActor("billing.view", "/dashboard/settings/tax-billing");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "legal_business_name, gstin, gst_address, state_code, default_hsn_sac, default_gst_rate, gst_verified_at, full_name",
    )
    .eq("id", ctx.ownerId)
    .single();

  const address = (profile?.gst_address as GstAddress | null) ?? {};

  const states = Object.entries(STATE_CODES)
    .filter(([code]) => !["97", "99"].includes(code))
    .map(([code, name]) => ({ code, name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Tax &amp; Billing</h1>
        <p className="text-sm text-muted-foreground">
          Your GST profile drives every invoice we generate. Inter-state /
          intra-state tax split is automatic.
        </p>
      </div>

      <TaxBillingForm
        states={states}
        verifiedAt={profile?.gst_verified_at ?? null}
        defaults={{
          legal_business_name:
            profile?.legal_business_name ?? profile?.full_name ?? "",
          gstin: profile?.gstin ?? "",
          state_code: profile?.state_code ?? "",
          default_hsn_sac: profile?.default_hsn_sac ?? "",
          default_gst_rate:
            typeof profile?.default_gst_rate === "number"
              ? profile.default_gst_rate
              : Number(profile?.default_gst_rate ?? 18),
          address_line1: address.line1 ?? "",
          address_line2: address.line2 ?? "",
          city: address.city ?? "",
          pincode: address.pincode ?? "",
        }}
        stateLabel={stateNameFromCode(profile?.state_code ?? null)}
      />
    </div>
  );
}
