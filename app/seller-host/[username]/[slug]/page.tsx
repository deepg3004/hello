// Seller-page render for {subdomain.invoxai.io}/[slug] AND
// {custom-domain}/[slug]. We reuse the same template registry as /p/[slug]
// — only the URL surface changes.
//
// notFound() if the slug isn't owned by this seller, so a typo'd URL on
// a seller's branded host returns 404 (not a stranger's page).

import { notFound } from "next/navigation";
import type { Metadata } from "next";

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
import {
  resolveSocialProofConfig,
  type SocialProofConfig,
} from "@/lib/social-proof";
import { PixelScripts } from "@/components/pages/PixelScripts";
import { ReferralTracker } from "@/components/pages/ReferralTracker";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import {
  loadSellerSite,
  loadSitePage,
  loadNavPages,
  loadSellerProducts,
} from "@/lib/site";

interface Props {
  params: { username: string; slug: string };
}

interface PageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  type: "payment" | "landing" | "lead_magnet";
  status: string;
  template_id: string;
  page_config: Record<string, unknown> | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_image_url: string | null;
  view_count: number;
  experiment_status: string | null;
}

interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
  active: boolean;
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

async function loadPage(username: string, slug: string) {
  const admin = createAdminClient();

  // 1. Find the seller behind the subdomain.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name")
    .eq("subdomain", username)
    .maybeSingle();
  if (!profile?.id) return null;

  // 2. Find the page for this seller + slug.
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, status, template_id, page_config, meta_title, meta_description, meta_image_url, view_count, experiment_status",
    )
    .eq("user_id", profile.id)
    .eq("slug", slug)
    .maybeSingle<PageRow>();
  if (!page || page.status !== "published") return null;

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

  return { page, product, pixel, seller: profile };
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  // Website (site_pages) metadata takes precedence over a product page.
  const site = await loadSellerSite(params.username);
  if (site) {
    const sp = await loadSitePage(site.id, { slug: params.slug });
    if (sp) {
      return {
        title: sp.seo_title ?? `${sp.title} · ${site.name}`,
        description: sp.seo_description ?? undefined,
        icons: site.favicon ? { icon: site.favicon } : undefined,
        openGraph: site.og_image ? { images: [{ url: site.og_image }] } : undefined,
      };
    }
  }

  const result = await loadPage(params.username, params.slug);
  if (!result) {
    return { title: params.slug };
  }
  const { page, seller } = result;
  const brandSuffix =
    seller.legal_business_name ?? seller.full_name ?? params.username;
  return {
    title: page.meta_title ?? `${page.title} · ${brandSuffix}`,
    description: page.meta_description ?? undefined,
    openGraph: {
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? undefined,
      images: page.meta_image_url ? [{ url: page.meta_image_url }] : undefined,
    },
  };
}

export default async function SellerPageRender({ params }: Props) {
  // A published website page (site_pages) takes precedence over a product page
  // with the same slug.
  const site = await loadSellerSite(params.username);
  if (site) {
    const sitePage = await loadSitePage(site.id, { slug: params.slug });
    if (sitePage) {
      const [products, navPages] = await Promise.all([
        loadSellerProducts(site.id),
        loadNavPages(site.id),
      ]);
      return (
        <SiteRenderer
          blocks={sitePage.blocks}
          themeKey={site.theme}
          fontKey={site.font}
          brandColor={site.brand_color}
          seller={{ name: site.name, avatar: site.avatar }}
          socialLinks={site.social_links}
          tagline={site.tagline}
          footerText={site.footer_text}
          footerLinks={site.footer_links}
          footerColumns={site.footer_columns}
          products={products}
          navPages={navPages}
          currentSlug={params.slug}
        />
      );
    }
  }

  const result = await loadPage(params.username, params.slug);
  if (!result) notFound();
  const { page, product, pixel } = result;

  const template = getTemplate(page.template_id);
  if (!template) notFound();

  // View counter (non-blocking).
  try {
    const admin = createAdminClient();
    await admin
      .from("pages")
      .update({ view_count: (page.view_count ?? 0) + 1 })
      .eq("id", page.id);
  } catch {
    /* non-fatal */
  }

  // A-side AB visitor counter, identical to /p/[slug].
  try {
    if (page.experiment_status === "running") {
      const redis = getRedis();
      if (redis) await redis.incr(visitorsKey(page.slug, "A"));
    }
  } catch {
    /* non-fatal */
  }

  const values = page.page_config ?? template.defaultValues;
  const countdownCfg = (values as Record<string, unknown>).countdown_config as
    | import("@/lib/conversion").CountdownConfig
    | undefined;
  const exitCfg = (values as Record<string, unknown>).exit_intent_config as
    | import("@/lib/conversion").ExitIntentConfig
    | undefined;

  let bumpRuntime: BumpRuntime = null;
  const bumpCfgRaw = (values as Record<string, unknown>).order_bump as
    | OrderBumpConfig
    | undefined;
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
    (values as Record<string, unknown>).social_proof_config as
      | SocialProofConfig
      | undefined,
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
