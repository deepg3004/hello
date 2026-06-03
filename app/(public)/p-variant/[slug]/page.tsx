// /p-variant/[slug] — internal route the middleware rewrites to when a
// visitor is bucketed into Variant B. Identical to /p/[slug] except it
// reads pages.variant_b_config and increments the B-side visitor counter.
//
// Buyers never see this path in their URL bar (the rewrite is server-side).

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PixelScripts } from "@/components/pages/PixelScripts";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates/registry";
import { PageCountdown } from "@/components/templates/shared/PageCountdown";
import { ExitIntentPopup } from "@/components/templates/shared/ExitIntentPopup";
import { isBumpReady, type OrderBumpConfig } from "@/lib/upsells";
import type { BumpRuntime } from "@/components/templates/shared/types";
import { getRedis } from "@/lib/redis";
import { visitorsKey } from "@/lib/ab";
import { SocialProofPopup } from "@/components/templates/shared/SocialProofPopup";
import { BuyerCountBadge } from "@/components/templates/shared/BuyerCountBadge";
import { ReferralTracker } from "@/components/pages/ReferralTracker";
import {
  resolveSocialProofConfig,
  type SocialProofConfig,
} from "@/lib/social-proof";

interface PageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  type: "payment" | "landing" | "lead_magnet";
  status: string;
  template_id: string;
  page_config: Record<string, unknown> | null;
  variant_b_config: Record<string, unknown> | null;
  experiment_status: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_image_url: string | null;
  view_count: number;
}

interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
}

interface PixelRow {
  meta_pixel_id: string | null;
  google_ads_id: string | null;
  google_ads_label: string | null;
  tiktok_pixel_id: string | null;
  hotjar_id: string | null;
  clarity_id?: string | null;
  custom_script?: string | null;
}

async function loadPage(slug: string) {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, status, template_id, page_config, variant_b_config, experiment_status, meta_title, meta_description, meta_image_url, view_count",
    )
    .eq("slug", slug)
    .single<PageRow>();
  if (!page || page.status !== "published") return null;
  // If the experiment has been stopped / promoted, fall back to the main
  // config (the seller may have removed variant_b_config).
  if (page.experiment_status !== "running" || !page.variant_b_config) {
    return null;
  }

  const { data: products } = await admin
    .from("products")
    .select("id, user_id, name, description, image_url, price, currency, active")
    .eq("user_id", page.user_id)
    .eq("page_id", page.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const product = (products?.[0] as ProductRow | undefined) ?? null;

  const { data: pixel } = await admin
    .from("pixel_configs")
    .select(
      "meta_pixel_id, google_ads_id, google_ads_label, tiktok_pixel_id, hotjar_id, clarity_id, custom_script",
    )
    .eq("page_id", page.id)
    .maybeSingle<PixelRow>();

  return { page, product, pixel };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await loadPage(params.slug);
  if (!result) {
    return { title: params.slug };
  }
  const { page } = result;
  const faviconUrl =
    typeof page.page_config?.favicon_url === "string" &&
    page.page_config.favicon_url.trim()
      ? page.page_config.favicon_url.trim()
      : null;
  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    icons: faviconUrl ? { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl } : undefined,
    openGraph: {
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? undefined,
      images: page.meta_image_url ? [{ url: page.meta_image_url }] : undefined,
    },
  };
}

export default async function VariantBPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!params.slug) notFound();
  const result = await loadPage(params.slug);

  if (!result) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-sora font-semibold tracking-tight">{params.slug}</h1>
        <p className="mt-4 text-muted-foreground">
          This page isn&apos;t running an A/B experiment right now.
        </p>
      </main>
    );
  }

  const { page, product, pixel } = result;
  const template = getTemplate(page.template_id);

  if (!template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-sora font-semibold tracking-tight">{page.title}</h1>
        <p className="mt-4 text-muted-foreground">
          This page uses a template we don&apos;t recognise.
        </p>
      </main>
    );
  }

  // Non-blocking view count bump.
  try {
    const admin = createAdminClient();
    await admin
      .from("pages")
      .update({ view_count: (page.view_count ?? 0) + 1 })
      .eq("id", page.id);
  } catch {
    /* non-fatal */
  }

  // B-side visitor counter — best-effort, no-ops without Redis.
  try {
    const redis = getRedis();
    if (redis) await redis.incr(visitorsKey(page.slug, "B"));
  } catch {
    /* non-fatal */
  }

  // The whole point of this route — use variant_b_config.
  const values = (page.variant_b_config ??
    page.page_config ??
    template.defaultValues) as Record<string, unknown>;

  const countdownCfg = values.countdown_config as
    | import("@/lib/conversion").CountdownConfig
    | undefined;
  const exitCfg = values.exit_intent_config as
    | import("@/lib/conversion").ExitIntentConfig
    | undefined;

  let bumpRuntime: BumpRuntime = null;
  const bumpCfgRaw = values.order_bump as OrderBumpConfig | undefined;
  if (isBumpReady(bumpCfgRaw)) {
    const admin = createAdminClient();
    const { data: bumpProd } = await admin
      .from("products")
      .select("id, name, price, active")
      .eq("id", bumpCfgRaw.product_id!)
      .single();
    if (bumpProd?.active) {
      bumpRuntime = {
        enabled: true,
        product_id: bumpProd.id,
        price: Number(bumpCfgRaw.price ?? bumpProd.price),
        title: bumpCfgRaw.title ?? bumpProd.name,
        description: bumpCfgRaw.description,
        image_url: bumpCfgRaw.image_url,
        ready: true,
      };
    }
  }

  const spCfg = resolveSocialProofConfig(
    values.social_proof_config as SocialProofConfig | undefined,
  );

  return (
    <>
      {countdownCfg?.enabled && countdownCfg.position !== "hidden" && (
        <PageCountdown pageSlug={page.slug} config={countdownCfg} />
      )}
      {spCfg.badge_enabled && (
        <BuyerCountBadge
          pageId={page.id}
          countType={spCfg.badge_count_type}
          labelText={spCfg.badge_label_text}
        />
      )}
      <template.Render
        values={values}
        pageId={page.id}
        product={product}
        bumpRuntime={bumpRuntime}
      />
      {exitCfg?.enabled && (
        <ExitIntentPopup pageSlug={page.slug} config={exitCfg} />
      )}
      {spCfg.popup_enabled && (
        <SocialProofPopup
          pageId={page.id}
          delayBetweenSeconds={spCfg.popup_delay_seconds}
          displayDurationSeconds={spCfg.popup_duration_seconds}
          position={spCfg.popup_position}
        />
      )}
      <PixelScripts pixel={pixel} />
      <ReferralTracker slug={page.slug} />
    </>
  );
}

// Pixel injection comes from components/pages/PixelScripts.tsx.
