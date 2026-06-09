import Link from "next/link";
import { AlertTriangle, Eye, Mail, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CredentialField } from "@/components/admin/CredentialField";
import { SettingTextInput } from "@/components/admin/SettingTextInput";
import { SendTestEmailButton } from "@/components/admin/SendTestEmailButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { vaultConfigured, decryptValue, maskValue } from "@/lib/admin/vault";
import { MAILBOX_ROLES, smtpKey, type MailboxRole } from "@/lib/emails/smtp";

export const metadata = { title: "Admin · Email" };

interface RoleDef {
  role: MailboxRole;
  title: string;
  suggestedAddress: string;
  fromNameDefault: string;
  blurb: string;
  /** Human list of email types that leave from this mailbox. */
  uses: string;
}

const ROLES: RoleDef[] = [
  {
    role: "kyc",
    title: "KYC mailbox",
    suggestedAddress: "kyc@invoxai.io",
    fromNameDefault: "InvoxAI KYC",
    blurb: "Identity & verification notices to sellers.",
    uses: "KYC approved, KYC rejected, re-KYC reminders.",
  },
  {
    role: "seller",
    title: "Seller / Partner mailbox",
    suggestedAddress: "partner@invoxai.io",
    fromNameDefault: "InvoxAI Partners",
    blurb: "Everything that lands in a seller's inbox.",
    uses: "Welcome, payout settled/failed, new-lead alerts, affiliate login codes.",
  },
  {
    role: "buyer",
    title: "Buyer mailbox",
    suggestedAddress: "info@invoxai.io",
    fromNameDefault: "InvoxAI",
    blurb: "Customer-facing purchase & delivery emails.",
    uses: "Telegram invites/expiry, lead-magnet delivery, cart recovery, CRM replies.",
  },
  {
    role: "onboarding",
    title: "New-user mailbox",
    suggestedAddress: "welcome@invoxai.io",
    fromNameDefault: "InvoxAI",
    blurb: "First-touch emails when someone joins.",
    uses: "Welcome email on signup.",
  },
  {
    role: "billing",
    title: "Billing mailbox",
    suggestedAddress: "billing@invoxai.io",
    fromNameDefault: "InvoxAI Billing",
    blurb: "Money & invoice emails to buyers.",
    uses: "Order receipts/invoices, payment failed, subscription renewals.",
  },
  {
    role: "legal",
    title: "Legal mailbox",
    suggestedAddress: "legal@invoxai.io",
    fromNameDefault: "InvoxAI Legal",
    blurb: "Terms, privacy & compliance correspondence.",
    uses: "Reserved for legal notices. Use as a sender/reply-to (no auto emails yet).",
  },
  {
    role: "support",
    title: "Support mailbox",
    suggestedAddress: "support@invoxai.io",
    fromNameDefault: "InvoxAI Support",
    blurb: "Help & reply-to address for human conversations.",
    uses: "Reserved for support replies. Use as a reply-to on other mailboxes.",
  },
  {
    role: "noreply",
    title: "No-reply / default mailbox",
    suggestedAddress: "noreply@invoxai.io",
    fromNameDefault: "InvoxAI",
    blurb: "Fallback for any email not tied to a specific audience.",
    uses: "System & uncategorized notices (default when no other mailbox applies).",
  },
];

// All smtp_* keys we need to bulk-read.
const FIELDS = ["user", "pass", "from_name", "reply_to"] as const;
const ALL_KEYS = [
  "email_admin_bcc",
  ...ROLES.flatMap((r) => FIELDS.map((f) => smtpKey(r.role, f))),
];

export default async function AdminEmailPage() {
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

  const get = (key: string) => stored.get(key)?.value ?? "";

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <DashboardHero
        title="Email"
        blurb="Send transactional email from your own Gmail mailboxes. Each audience gets its own branded address — buyers, sellers, KYC, support. Empty mailboxes fall back to Resend."
        resourcesHref={null}
      >
        <Link
          href="/admin/email/templates"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <Eye className="h-4 w-4" />
          Preview all templates
        </Link>
      </DashboardHero>

      {/* ── Vault status banner ──────────────────────────────────── */}
      {vaultOk ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 animate-in-up" style={{ animationDelay: "60ms" }}>
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Vault encrypted</p>
            <p className="mt-0.5">
              App passwords are stored with AES-256-GCM. Generate one at{" "}
              <code className="font-mono text-xs">
                myaccount.google.com → Security → App passwords
              </code>{" "}
              (needs 2-Step Verification on).
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 animate-in-up" style={{ animationDelay: "60ms" }}>
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">
              Vault key missing — app passwords can&apos;t be stored
            </p>
            <p className="mt-1">
              Set{" "}
              <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-xs">
                INVOXAI_VAULT_KEY
              </code>{" "}
              (32-byte hex) in your env and redeploy before saving Gmail
              passwords.
            </p>
          </div>
        </div>
      )}

      {/* ── Propagation note ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground animate-in-up" style={{ animationDelay: "120ms" }}>
        Credential changes take effect within ~60 seconds (config is cached).
        After saving, use <strong>Send test email</strong> to confirm a mailbox
        before relying on it. If you run a separate worker process, it must share
        the same <code className="font-mono">INVOXAI_VAULT_KEY</code> to decrypt
        these passwords.
      </div>

      {/* ── Admin BCC ────────────────────────────────────────────── */}
      <Card className="animate-in-up" style={{ animationDelay: "180ms" }}>
        <CardHeader>
          <CardTitle className="text-base">Admin copy (BCC)</CardTitle>
          <CardDescription>
            Silently BCC a copy of every email the platform sends to this inbox.
            Leave blank to disable. (Supabase auth emails — signup/reset — are
            sent by Supabase and aren&apos;t included.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingTextInput
            storageKey="email_admin_bcc"
            label="BCC address"
            initialValue={get("email_admin_bcc")}
            placeholder="sadmin@invoxai.io"
          />
        </CardContent>
      </Card>

      {/* ── Per-mailbox cards ────────────────────────────────────── */}
      {ROLES.map((def, idx) => {
        const tiles = ["tile-indigo", "tile-emerald", "tile-amber", "tile-rose", "tile-violet"];
        const tile = tiles[idx % tiles.length];
        const passKey = smtpKey(def.role, "pass");
        const passRow = stored.get(passKey);
        const passEmpty = !passRow?.value;
        const passMasked = passEmpty
          ? "—"
          : passRow.encrypted
            ? "•".repeat(20) + " encrypted"
            : maskValue(passRow.value);
        // Pre-check decryption so a later reveal won't surprise the admin.
        if (!passEmpty && passRow.encrypted && vaultOk) {
          try {
            decryptValue(passRow.value);
          } catch {
            /* ignore — reveal action surfaces it */
          }
        }

        return (
          <Card
            key={def.role}
            className="animate-in-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md"
            style={{ animationDelay: `${240 + idx * 60}ms` }}
          >
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tile}`}>
                  <Mail className="h-5 w-5" />
                </span>
                <CardTitle className="text-base">{def.title}</CardTitle>
              </div>
              <CardDescription>
                {def.blurb}
                <span className="mt-1 block text-xs">
                  <span className="font-medium text-foreground">Sends:</span>{" "}
                  {def.uses}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingTextInput
                storageKey={smtpKey(def.role, "user")}
                label="Gmail address"
                description="The Google account used to send. Also the default From address."
                initialValue={get(smtpKey(def.role, "user")) || def.suggestedAddress}
                placeholder={def.suggestedAddress}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium">App password</p>
                <CredentialField
                  storageKey={passKey}
                  label="Gmail app password"
                  description="16-character app password (not your normal Google password)."
                  masked={passMasked}
                  encrypted
                  empty={passEmpty}
                />
              </div>

              <SettingTextInput
                storageKey={smtpKey(def.role, "from_name")}
                label="From display name"
                initialValue={
                  get(smtpKey(def.role, "from_name")) || def.fromNameDefault
                }
                placeholder={def.fromNameDefault}
              />
              <SettingTextInput
                storageKey={smtpKey(def.role, "reply_to")}
                label="Reply-To (optional)"
                description="Where replies land. Leave blank to reply to the Gmail address above."
                initialValue={get(smtpKey(def.role, "reply_to"))}
                placeholder="support@invoxai.io"
              />

              <div className="flex justify-end border-t border-border pt-3">
                <SendTestEmailButton role={def.role} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
