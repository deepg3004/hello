import { AlertTriangle, CreditCard, Database, KeyRound, MessageSquare, Cloud, ShieldCheck } from "lucide-react";

import { CredentialField } from "@/components/admin/CredentialField";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { vaultConfigured, decryptValue, maskValue } from "@/lib/admin/vault";

export const metadata = { title: "Admin · Credentials" };

interface CredentialDef {
  key: string;
  label: string;
  description?: string;
  encrypted: boolean;
}

interface CredentialGroup {
  id: string;
  title: string;
  blurb: string;
  items: CredentialDef[];
}

// Grouped vault definitions — easy to scan, easy to extend.
const GROUPS: CredentialGroup[] = [
  {
    id: "razorpay",
    title: "Razorpay",
    blurb: "Payment gateway + subscription plans + webhooks.",
    items: [
      { key: "RAZORPAY_KEY_ID", label: "Razorpay Key ID", encrypted: false, description: "Public — safe to expose to client." },
      { key: "RAZORPAY_KEY_SECRET", label: "Razorpay Key Secret", encrypted: true },
      { key: "RAZORPAY_WEBHOOK_SECRET", label: "Razorpay Webhook Secret", encrypted: true },
      { key: "STARTER_PLAN_ID", label: "Razorpay Plan: Starter", encrypted: false },
      { key: "PRO_PLAN_ID", label: "Razorpay Plan: Pro", encrypted: false },
      { key: "BUSINESS_PLAN_ID", label: "Razorpay Plan: Business", encrypted: false },
    ],
  },
  {
    id: "supabase",
    title: "Supabase",
    blurb: "Auth + database + storage.",
    items: [
      { key: "SUPABASE_URL", label: "Supabase URL", encrypted: false },
      { key: "SUPABASE_ANON_KEY", label: "Supabase Anon Key", encrypted: false },
      { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service-Role Key", encrypted: true },
    ],
  },
  {
    id: "messaging",
    title: "Messaging",
    blurb: "Transactional email + SMS + WhatsApp.",
    items: [
      { key: "RESEND_API_KEY", label: "Resend API Key", encrypted: true, description: "Transactional email — order receipts, KYC updates." },
      { key: "TWILIO_ACCOUNT_SID", label: "Twilio Account SID", encrypted: false, description: "From console.twilio.com — starts with AC..." },
      { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", encrypted: true },
      { key: "TWILIO_PHONE_NUMBER", label: "Twilio SMS From (E.164)", encrypted: false, description: "e.g. +13393303027" },
      { key: "TWILIO_WHATSAPP_FROM", label: "Twilio WhatsApp From", encrypted: false, description: "Sandbox: whatsapp:+14155238886. Replace with your approved sender post-Meta." },
      { key: "MSG91_AUTH_KEY", label: "MSG91 Auth Key (deprecated)", encrypted: true, description: "Replaced by Twilio. Kept for one-line rollback." },
      { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", encrypted: true, description: "Platform Telegram VIP bot." },
    ],
  },
  {
    id: "kyc",
    title: "KYC (Surepass)",
    blurb: "PAN + Aadhaar + bank-name verification.",
    items: [
      { key: "SUREPASS_TOKEN", label: "Surepass KYC Token", encrypted: true, description: "Bearer token for PAN / bank / Aadhaar verification." },
    ],
  },
  {
    id: "cloudflare",
    title: "Cloudflare",
    blurb: "DNS automation for seller subdomains + cache control.",
    items: [
      { key: "CLOUDFLARE_API_TOKEN", label: "Cloudflare API Token", encrypted: true, description: "Zone:DNS:Edit + Zone:Zone:Read for invoxai.io zone." },
      { key: "CLOUDFLARE_ZONE_ID", label: "Cloudflare Zone ID", encrypted: false },
    ],
  },
];

// Flattened key list — used to bulk-fetch from platform_settings.
const ALL_KEYS = GROUPS.flatMap((g) => g.items.map((i) => i.key));

export default async function AdminCredentialsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key, value, encrypted")
    .in("key", ALL_KEYS);

  const stored = new Map(
    ((data ?? []) as Array<{ key: string; value: string; encrypted: boolean }>).map(
      (r) => [r.key, { value: r.value, encrypted: r.encrypted }],
    ),
  );
  const vaultOk = vaultConfigured();

  // Per-group fill stats for the section header.
  function groupFillStats(g: CredentialGroup) {
    let set = 0;
    for (const item of g.items) {
      const row = stored.get(item.key);
      if (row?.value) set++;
    }
    return { set, total: g.items.length };
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <DashboardHero
        title="Credentials"
        blurb="Sensitive platform secrets, stored encrypted in platform_settings. Every reveal and edit is audit-logged."
        resourcesHref={null}
      />

      {/* ── Vault status banner ──────────────────────────────────── */}
      <div
        className="animate-in-up"
        style={{ animationDelay: "100ms" }}
      >
        {vaultOk ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Vault encrypted</p>
              <p className="mt-0.5">
                <code className="font-mono">INVOXAI_VAULT_KEY</code> is set —
                encrypted secrets are stored with AES-256-GCM and readable only
                by this server process.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">
                Vault key missing — credentials cannot be stored
              </p>
              <p className="mt-1">
                Set{" "}
                <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-xs">
                  INVOXAI_VAULT_KEY
                </code>{" "}
                (32-byte hex) in your env and redeploy before storing encrypted
                secrets. Generate one with:
              </p>
              <p className="mt-2">
                <code className="rounded bg-rose-100 px-1.5 py-1 font-mono text-xs">
                  node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
                </code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Grouped vault rows ───────────────────────────────────── */}
      {GROUPS.map((g, idx) => {
        const { set, total } = groupFillStats(g);
        const tiles = ["tile-indigo", "tile-emerald", "tile-amber", "tile-rose", "tile-violet"];
        const icons = [CreditCard, Database, MessageSquare, ShieldCheck, Cloud];
        const Icon = icons[idx % icons.length];
        return (
          <section
            key={g.id}
            className="space-y-3 animate-in-up"
            style={{ animationDelay: `${200 + idx * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tiles[idx % tiles.length]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="font-sora text-base font-semibold tracking-tight">
                  {g.title}
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {set} / {total} set
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{g.blurb}</p>

            <div className="space-y-2">
              {g.items.map((c) => {
                const row = stored.get(c.key);
                const empty = !row?.value;
                const masked = empty
                  ? "—"
                  : row.encrypted
                    ? "•".repeat(28) + " encrypted"
                    : maskValue(row.value);
                // Pre-check decryption silently so a later reveal won't
                // surprise the admin with a cryptic error.
                if (!empty && row.encrypted && vaultOk) {
                  try {
                    decryptValue(row.value);
                  } catch {
                    /* ignore — reveal action surfaces it */
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
            </div>
          </section>
        );
      })}

      {/* Footer — small reminder that auto-reload is a thing */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Revealed values auto-mask after 10 seconds. After saving any
          credential the server reloads so the new value is in effect immediately
          — no PM2 restart needed unless the worker process also reads it.
        </p>
      </div>
    </div>
  );
}
