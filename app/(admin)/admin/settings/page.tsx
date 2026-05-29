import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingNumberInput } from "@/components/admin/SettingNumberInput";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · Platform Settings" };

interface SettingRow {
  key: string;
  value: string;
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .single<{ value: string }>();
  return data?.value ?? fallback;
}

export default async function AdminPlatformSettingsPage() {
  const [commission, minPayout] = await Promise.all([
    getSetting("platform_commission_percent", "5"),
    getSetting("min_payout_amount", "500"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
        <p className="text-sm text-muted-foreground">
          Runtime knobs. Changes are persisted to <code>platform_settings</code> and audit-logged.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Economics</CardTitle>
          <CardDescription>
            The platform commission applies to every new order. Existing orders keep their captured commission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingNumberInput
            storageKey="platform_commission_percent"
            label="Platform commission"
            description="Percent deducted from every paid order before settlement to the seller."
            initialValue={commission}
            suffix="%"
          />
          <SettingNumberInput
            storageKey="min_payout_amount"
            label="Minimum payout"
            description="Lowest amount a seller can withdraw in a single request."
            initialValue={minPayout}
            suffix="INR"
          />
        </CardContent>
      </Card>
    </div>
  );
}
