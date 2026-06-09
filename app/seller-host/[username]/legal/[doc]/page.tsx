// Seller legal/contact pages at <subdomain>/legal/<doc> — privacy, terms,
// refund, contact. Themed with the seller's storefront header + footer, with
// content the seller edits in Dashboard → Storefront Design → Header & Footer.

import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveSurfaceConfig,
  resolveChromeConfig,
  LEGAL_DOCS,
  type LegalDoc,
} from "@/lib/storefront-theme";
import { StorefrontShell } from "@/components/store/StorefrontShell";
import { mdLite } from "@/lib/md-lite";

interface Props {
  params: { username: string; doc: string };
}

export const dynamic = "force-dynamic";

function docMeta(doc: string) {
  return LEGAL_DOCS.find((d) => d.key === doc) ?? null;
}

export async function generateMetadata({ params }: Props) {
  noStore();
  const meta = docMeta(params.doc);
  return { title: meta?.label ?? "Legal" };
}

export default async function LegalPage({ params }: Props) {
  noStore();
  const meta = docMeta(params.doc);
  if (!meta) notFound();
  const doc = meta.key as LegalDoc;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "home");
  const chrome = resolveChromeConfig(profile.storefront_config);
  const sellerName = profile.legal_business_name ?? profile.full_name ?? params.username;
  const content = chrome.legal[doc]?.trim();

  return (
    <StorefrontShell cfg={cfg} chrome={chrome} brandName={sellerName} sellerId={profile.id} username={params.username}>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="sf-display text-3xl font-bold tracking-tight">{meta.label}</h1>
        <p className="sf-muted mt-1 text-sm">{sellerName}</p>
        {content ? (
          <div
            className="sf-muted mt-6 space-y-3 text-sm leading-relaxed [&_a]:text-[color:var(--sf-accent)] [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[color:var(--sf-fg)]"
            dangerouslySetInnerHTML={{ __html: mdLite(content) }}
          />
        ) : (
          <div className="sf-card mt-6 p-6 text-sm sf-muted">
            {doc === "contact"
              ? "Contact details haven’t been added yet. Please check back soon."
              : "This policy hasn’t been published yet. Please check back soon."}
          </div>
        )}
      </main>
    </StorefrontShell>
  );
}
