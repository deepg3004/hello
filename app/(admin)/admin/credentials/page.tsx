import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CredentialField } from "@/components/admin/CredentialField";
import { createAdminClient } from "@/lib/supabase/admin";
import { vaultConfigured, decryptValue, maskValue } from "@/lib/admin/vault";

export const metadata = { title: "Admin · Credentials" };

interface CredentialDef {
  key: string;
  label: string;
  description?: string;
  encrypted: boolean;
}

const CREDENTIALS: CredentialDef[] = [
  { key: "RAZORPAY_KEY_ID", label: "Razorpay Key ID", encrypted: false, description: "Public — safe to expose to client." },
  { key: "RAZORPAY_KEY_SECRET", label: "Razorpay Key Secret", encrypted: true },
  { key: "RAZORPAY_WEBHOOK_SECRET", label: "Razorpay Webhook Secret", encrypted: true },
  { key: "SUPABASE_URL", label: "Supabase URL", encrypted: false },
  { key: "SUPABASE_ANON_KEY", label: "Supabase Anon Key", encrypted: false },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service-Role Key", encrypted: true },
  { key: "RESEND_API_KEY", label: "Resend API Key", encrypted: true },
  // Twilio (primary SMS / WhatsApp provider)
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio Account SID", encrypted: false, description: "From console.twilio.com — starts with AC..." },
  { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", encrypted: true },
  { key: "TWILIO_PHONE_NUMBER", label: "Twilio SMS From (E.164)", encrypted: false, description: "e.g. +13393303027" },
  { key: "TWILIO_WHATSAPP_FROM", label: "Twilio WhatsApp From", encrypted: false, description: "e.g. whatsapp:+14155238886 (sandbox) or your approved sender" },
  // MSG91 (deprecated — kept so reverting is easy)
  { key: "MSG91_AUTH_KEY", label: "MSG91 Auth Key (deprecated, replaced by Twilio)", encrypted: true },
  { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", encrypted: true, description: "For platform notifications." },
  { key: "SUREPASS_TOKEN", label: "Surepass KYC Token", encrypted: true, description: "Bearer token for PAN / bank / Aadhaar verification." },
  { key: "STARTER_PLAN_ID", label: "Razorpay Plan: Starter", encrypted: false },
  { key: "PRO_PLAN_ID", label: "Razorpay Plan: Pro", encrypted: false },
  { key: "BUSINESS_PLAN_ID", label: "Razorpay Plan: Business", encrypted: false },
];

export default async function AdminCredentialsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key, value, encrypted")
    .in(
      "key",
      CREDENTIALS.map((c) => c.key),
    );

  const stored = new Map(
    ((data ?? []) as Array<{ key: string; value: string; encrypted: boolean }>).map(
      (r) => [r.key, { value: r.value, encrypted: r.encrypted }],
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credentials</h1>
        <p className="text-sm text-muted-foreground">
          Sensitive platform secrets. Stored encrypted in <code>platform_settings</code>. Every reveal and edit is audit-logged.
        </p>
      </div>

      {!vaultConfigured() && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Vault key not set</p>
            <p className="mt-1">
              Set <code className="font-mono">INVOXAI_VAULT_KEY</code> (32-byte hex) in your env
              and redeploy before storing encrypted secrets.
            </p>
            <p className="mt-1">
              <code className="font-mono text-xs">
                node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </code>
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vault entries</CardTitle>
          <CardDescription>
            These currently live in <code>.env</code>. Once you store + wire them here, this
            page becomes the source of truth at runtime (refactor pending).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CREDENTIALS.map((c) => {
            const row = stored.get(c.key);
            const empty = !row?.value;
            const masked = empty
              ? "—"
              : row.encrypted
                ? "•".repeat(24) + "encrypted"
                : maskValue(row.value);
            // Sanity-check decryption silently for encrypted rows so revealing later won't surprise.
            if (!empty && row.encrypted && vaultConfigured()) {
              try {
                decryptValue(row.value);
              } catch {
                /* ignore here; reveal action surfaces the error */
              }
            }
            return (
              <CredentialField
                key={c.key}
                storageKey={c.key}
                label={c.label}
                description={c.description}
                masked={masked}
                encrypted={c.encrypted}
                empty={empty}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
