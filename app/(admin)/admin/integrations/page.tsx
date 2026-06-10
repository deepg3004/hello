// Admin · Integrations — configure the AI generator (Anthropic) and buyer
// Google login from the panel instead of editing env. Values are stored in
// platform_settings (secrets AES-encrypted via INVOXAI_VAULT_KEY) and read at
// runtime with an env fallback (lib/integration-settings).

import { Sparkles, Chrome, ShieldCheck, KeyRound, Info, ExternalLink, CreditCard } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { maskValue, vaultConfigured } from "@/lib/admin/vault";
import {
  getAnthropicCredential,
  getGoogleBuyerConfig,
} from "@/lib/integration-settings";
import { platformRootDomain } from "@/lib/domains";
import { CredentialField } from "@/components/admin/CredentialField";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Integrations" };
export const dynamic = "force-dynamic";

const KEYS = [
  "anthropic_api_key",
  "anthropic_auth_token",
  "google_client_id",
  "google_client_secret",
  "buyer_oauth_base_url",
];

interface FieldSpec {
  key: string;
  label: string;
  encrypted: boolean;
  description?: string;
}

export default async function AdminIntegrationsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key, value, encrypted")
    .in("key", KEYS);
  const stored = new Map(
    ((data ?? []) as Array<{ key: string; value: string; encrypted: boolean }>).map(
      (r) => [r.key, { value: r.value, encrypted: r.encrypted }],
    ),
  );

  const [anthropic, google] = await Promise.all([
    getAnthropicCredential(),
    getGoogleBuyerConfig(),
  ]);
  const vaultOk = vaultConfigured();
  const redirectUri = `${google.baseUrl?.replace(/\/+$/, "") ?? `https://${platformRootDomain()}`}/api/buyer/google/callback`;

  function renderField(f: FieldSpec) {
    const row = stored.get(f.key);
    const empty = !row?.value;
    const masked = empty
      ? "—"
      : row.encrypted
        ? "•".repeat(28) + " encrypted"
        : maskValue(row.value);
    return (
      <CredentialField
        key={f.key}
        storageKey={f.key}
        label={f.label}
        description={f.description}
        masked={masked}
        encrypted={f.encrypted}
        empty={empty}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Integrations"
        blurb="Connect the AI generator and buyer Google login. Saved here, no redeploy needed — env stays as a fallback."
        resourcesHref={null}
      />

      {!vaultOk && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Set INVOXAI_VAULT_KEY first</p>
            <p className="mt-0.5 text-amber-700">
              Encrypted secrets (API keys/tokens) can&apos;t be saved until a 32-byte vault key is in your env.
              Generate one and add it to <code className="font-mono">.env.production</code>, then redeploy:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-amber-100/60 p-2 font-mono text-xs">node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;</pre>
          </div>
        </div>
      )}

      {/* ── AI generator (Anthropic) ─────────────────────────────────────── */}
      <section className="card-surface space-y-4 p-5 animate-in-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl tile-violet">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-sora text-base font-semibold tracking-tight">AI website generator</h2>
              <p className="text-xs text-muted-foreground">Anthropic Claude — powers /dashboard/builder/ai.</p>
            </div>
          </div>
          <SourceBadge source={anthropic.source} />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground"><Info className="h-3.5 w-3.5" /> Two ways to connect — set either one:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li><strong>API key</strong> (recommended): sign in at <a className="text-primary underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> → API keys → Create key. Starts with <code className="font-mono">sk-ant-api…</code></li>
            <li><strong>Account auth token</strong>: from a Claude account, run <code className="font-mono">claude setup-token</code> (or <code className="font-mono">ant auth login</code>) and paste the <code className="font-mono">sk-ant-oat…</code> token. Use this to bill your normal Claude account instead of a separate API key.</li>
          </ol>
          <p className="mt-1.5">The API key is used first when both are set. You can add a key later — the feature stays hidden until one is present.</p>
        </div>

        {/* Generate / connect buttons → open Anthropic's console to create the key, then paste below. */}
        <div className="flex flex-wrap gap-2">
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> Generate API key on Anthropic
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
          <a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <CreditCard className="h-4 w-4" /> Add credits / billing
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Click <strong>Generate API key on Anthropic</strong> → create &amp; copy the key (<code className="font-mono">sk-ant-api…</code>) → paste it in the field below and Save.
          For the account auth token instead, run <code className="font-mono">claude setup-token</code> in a terminal (Max/Pro account) and paste the <code className="font-mono">sk-ant-oat…</code> token.
        </p>

        <div className="space-y-2">
          {renderField({ key: "anthropic_api_key", label: "Anthropic API key", encrypted: true, description: "sk-ant-api… — from console.anthropic.com." })}
          {renderField({ key: "anthropic_auth_token", label: "Anthropic account auth token", encrypted: true, description: "sk-ant-oat… — your normal Claude account, via `claude setup-token`." })}
        </div>
      </section>

      {/* ── Buyer Google login ───────────────────────────────────────────── */}
      <section className="card-surface space-y-4 p-5 animate-in-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl tile-indigo">
              <Chrome className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-sora text-base font-semibold tracking-tight">Buyer Google login</h2>
              <p className="text-xs text-muted-foreground">&quot;Continue with Google&quot; on storefront /account portals.</p>
            </div>
          </div>
          <SourceBadge source={google.source} />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground"><Info className="h-3.5 w-3.5" /> Set up the Google OAuth client:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Open <a className="text-primary underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console → APIs &amp; Services → Credentials</a>.</li>
            <li>Configure the OAuth consent screen (External; add app name + support email).</li>
            <li>Create credentials → <strong>OAuth client ID</strong> → type <strong>Web application</strong>.</li>
            <li>Under <strong>Authorized redirect URIs</strong>, add exactly:
              <pre className="mt-1 overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px]">{redirectUri}</pre>
              (set the base URL below if it differs, then re-copy this.)
            </li>
            <li>Copy the <strong>Client ID</strong> and <strong>Client secret</strong> into the fields below and Save.</li>
          </ol>
        </div>

        <div>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Chrome className="h-4 w-4" /> Open Google Cloud Console
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
        </div>

        <div className="space-y-2">
          {renderField({ key: "google_client_id", label: "Google Client ID", encrypted: false, description: "…apps.googleusercontent.com (not secret)." })}
          {renderField({ key: "google_client_secret", label: "Google Client Secret", encrypted: true, description: "GOCSPX-… — keep secret." })}
          {renderField({ key: "buyer_oauth_base_url", label: "OAuth base URL", encrypted: false, description: `Central host Google returns to. Defaults to https://${platformRootDomain()}` })}
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Buyer-portal secrets stay in env (security)</p>
            <p className="mt-0.5">
              <code className="font-mono">BUYER_OTP_SALT</code> and <code className="font-mono">BUYER_PORTAL_SECRET</code> sign buyer sessions — they live in
              <code className="font-mono"> .env.production</code> (≥16 chars), not here, because rotating them logs every buyer out. Generate each with:
            </p>
            <pre className="mt-1.5 overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px]">node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(24).toString(&apos;hex&apos;))&quot;</pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourceBadge({ source }: { source: "admin" | "env" | "none" }) {
  if (source === "none") {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Not configured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
      <ShieldCheck className="h-3 w-3" />
      Active · {source === "admin" ? "saved here" : "from env"}
    </span>
  );
}
