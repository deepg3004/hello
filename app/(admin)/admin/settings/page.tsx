import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingNumberInput } from "@/components/admin/SettingNumberInput";
import { SettingTextInput } from "@/components/admin/SettingTextInput";
import { SettingImageInput } from "@/components/admin/SettingImageInput";
import { SettingToggle } from "@/components/admin/SettingToggle";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · Platform Settings" };

async function readAll(keys: string[]): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", keys);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.key] = row.value as string;
  }
  return map;
}

const KEYS = [
  "platform_name",
  "platform_logo_url",
  "maintenance_mode",
  "maintenance_message",
  "platform_commission_percent",
  "commission_per_plan",
  "min_payout_amount",
  "kyc_l3_gmv_threshold",
  "support_email",
  "support_telegram_url",
  "terms_url",
  "privacy_url",
  "email_from_address",
  "email_from_name",
  "email_reply_to",
  "feature_affiliate",
  "feature_custom_domains",
  "feature_ab_testing",
  "feature_telegram_vip",
  "allow_custom_scripts",
];

export default async function AdminPlatformSettingsPage() {
  const s = await readAll(KEYS);
  const get = (k: string, fallback = "") => s[k] ?? fallback;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Platform settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Runtime knobs. Every save persists to <code>platform_settings</code>{" "}
          and lands in the audit log.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
          <CardDescription>
            Brand name + logo shown on the maintenance page and in every email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingTextInput
            storageKey="platform_name"
            label="Platform name"
            initialValue={get("platform_name", "InvoxAI")}
          />
          <SettingImageInput
            storageKey="platform_logo_url"
            label="Brand logo"
            description="Paste an image URL or upload a PNG/SVG (transparent background recommended)."
            initialValue={get("platform_logo_url")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance mode</CardTitle>
          <CardDescription>
            Turn this on during cutover windows. Every public + dashboard URL
            replies with a 503 to the maintenance page. Admins bypass it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingToggle
            storageKey="maintenance_mode"
            label="Enable maintenance mode"
            description="Buyers see the maintenance page until you flip this off."
            initialValue={get("maintenance_mode", "false")}
            destructive
          />
          <SettingTextInput
            storageKey="maintenance_message"
            label="Customer-facing message"
            initialValue={get(
              "maintenance_message",
              "We'll be back shortly.",
            )}
            multiline
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Economics</CardTitle>
          <CardDescription>
            Defaults apply to new orders. Existing rows keep their captured
            commission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingNumberInput
            storageKey="platform_commission_percent"
            label="Default platform commission"
            description="Used when a seller's plan isn't in the per-plan map below."
            initialValue={get("platform_commission_percent", "5")}
            suffix="%"
          />
          <SettingTextInput
            storageKey="commission_per_plan"
            label="Per-plan commission overrides (JSON)"
            description='Example: {"free":5,"starter":4.5,"pro":3.5,"business":2.5} — keys must be plan ids.'
            initialValue={get(
              "commission_per_plan",
              '{"free":5,"starter":4.5,"pro":3.5,"business":2.5}',
            )}
            multiline
          />
          <SettingNumberInput
            storageKey="min_payout_amount"
            label="Minimum payout"
            description="Lowest amount a seller can withdraw in a single request."
            initialValue={get("min_payout_amount", "500")}
            suffix="INR"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">KYC thresholds</CardTitle>
          <CardDescription>
            Sellers crossing the GMV threshold are required to complete the
            next KYC level before withdrawals continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingNumberInput
            storageKey="kyc_l3_gmv_threshold"
            label="KYC Level 3 GMV trigger"
            description="Lifetime GMV (₹) above which Aadhaar + selfie become required."
            initialValue={get("kyc_l3_gmv_threshold", "500000")}
            suffix="INR"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support &amp; legal</CardTitle>
          <CardDescription>
            Public-facing contact + legal links. The support address also
            doubles as the reply-to on every transactional email by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingTextInput
            storageKey="support_email"
            label="Support email"
            initialValue={get("support_email", "support@invoxai.io")}
          />
          <SettingTextInput
            storageKey="support_telegram_url"
            label="Telegram support URL"
            description="Optional. Surface as a help link in the dashboard."
            initialValue={get("support_telegram_url")}
            placeholder="https://t.me/invoxai_support"
          />
          <SettingTextInput
            storageKey="terms_url"
            label="Terms of Service URL"
            initialValue={get("terms_url")}
            placeholder="https://invoxai.io/legal/terms"
          />
          <SettingTextInput
            storageKey="privacy_url"
            label="Privacy Policy URL"
            initialValue={get("privacy_url")}
            placeholder="https://invoxai.io/legal/privacy"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email envelope</CardTitle>
          <CardDescription>
            From / reply-to applied to every transactional email. Override the
            env-var defaults on a per-environment basis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingTextInput
            storageKey="email_from_address"
            label="From address"
            initialValue={get("email_from_address", "noreply@invoxai.io")}
          />
          <SettingTextInput
            storageKey="email_from_name"
            label="From display name"
            initialValue={get("email_from_name", "InvoxAI")}
          />
          <SettingTextInput
            storageKey="email_reply_to"
            label="Reply-To"
            description="Where buyer replies land — typically your support inbox."
            initialValue={get("email_reply_to", "support@invoxai.io")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature flags</CardTitle>
          <CardDescription>
            Kill switches for individual product surfaces — useful when
            rolling out new features gradually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingToggle
            storageKey="feature_affiliate"
            label="Affiliate system"
            description="When off, seller and buyer affiliate links 404."
            initialValue={get("feature_affiliate", "true")}
          />
          <SettingToggle
            storageKey="feature_custom_domains"
            label="Custom domains"
            description="When off, the custom-domain field on pages is read-only."
            initialValue={get("feature_custom_domains", "true")}
          />
          <SettingToggle
            storageKey="feature_ab_testing"
            label="A/B testing"
            description="When off, the A/B test tab is hidden on pages."
            initialValue={get("feature_ab_testing", "true")}
          />
          <SettingToggle
            storageKey="feature_telegram_vip"
            label="Telegram VIP sales"
            description="When off, the Telegram VIP template is disabled."
            initialValue={get("feature_telegram_vip", "true")}
          />
          <SettingToggle
            storageKey="allow_custom_scripts"
            label="Custom scripts in Pixels tab"
            description="Pro+ sellers can paste raw <script> blocks. Flip off to kill in one click."
            initialValue={get("allow_custom_scripts", "true")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
