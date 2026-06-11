import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createAdminClient } from "@/lib/supabase/admin";
import { pagePrefix, publicPagePath, type PagePrefix } from "@/lib/page-url";
import { PixelScripts } from "@/components/pages/PixelScripts";
import { TrackingProvider } from "@/components/tracking/TrackingProvider";
import { getTemplate } from "@/lib/templates/registry";
import { PageSkin } from "@/components/templates/PageSkin";
import { CheckoutConfigProvider } from "@/components/pages/CheckoutConfig";
import { checkoutConfigFromValues } from "@/lib/checkout-config";
import { PageCountdown } from "@/components/templates/shared/PageCountdown";
import { ExitIntentPopup } from "@/components/templates/shared/ExitIntentPopup";
import { isBumpReady, type OrderBumpConfig } from "@/lib/upsells";
import type { BumpRuntime } from "@/components/templates/shared/types";
import { getRedis } from "@/lib/redis";
import { visitorsKey } from "@/lib/ab";
import { SocialProofPopup } from "@/components/templates/shared/SocialProofPopup";
import { BuyerCountBadge } from "@/components/templates/shared/BuyerCountBadge";
import { ReferralTracker } from "@/components/pages/ReferralTracker";
import { WishlistButton } from "@/components/buyer/WishlistButton";
import {
  resolveSocialProofConfig,
  type SocialProofConfig,
} from "@/lib/social-proof";

// Always render fresh — sellers expect plan/theme/page edits to show
// immediately. Without this, Next's Data Cache serves stale page_config.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
  original_price: number | null;
  is_popular: boolean | null;
  currency: string;
  active: boolean;
  /** Days of access granted after purchase. NULL = no expiry (lifetime). */
  subscription_days: number | null;
  /** "Monthly", "Yearly", "Lifetime" — short label rendered on the tier card. */
  display_label: string | null;
  sort_order: number;
  /** Physical-product fields (Session 10). */
  requires_shipping?: boolean | null;
  stock?: number | null;
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
      "id, user_id, title, slug, type, status, template_id, page_config, meta_title, meta_description, meta_image_url, view_count, experiment_status",
    )
    .eq("slug", slug)
    .single<PageRow>();
  if (!page) return null;
  // Page exists but is unpublished/paused → signal the caller to bounce the
  // visitor to the main site (instead of showing a draft).
  if (page.status !== "published") return { unpublished: true as const };

  // Load all active products for the page, ordered as the seller arranged.
  // Single-product pages just see one row; tiered pages (Telegram VIP with
  // Weekly/Monthly/Yearly/Lifetime) see multiple. Template decides how to
  // render — `product` is the default (lowest sort_order) for backward compat.
  const { data: products } = await admin
    .from("products")
    .select(
      "id, user_id, name, description, image_url, price, original_price, is_popular, currency, active, subscription_days, display_label, sort_order, requires_shipping, stock",
    )
    .eq("user_id", page.user_id)
    .eq("page_id", page.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const productList = (products ?? []) as ProductRow[];
  const product = productList[0] ?? null;

  const { data: pixel } = await admin
    .from("pixel_configs")
    .select(
      "meta_pixel_id, google_ads_id, google_ads_label, tiktok_pixel_id, hotjar_id, clarity_id, custom_script",
    )
    .eq("page_id", page.id)
    .maybeSingle<PixelRow>();

  return { page, product, products: productList, pixel };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await loadPage(params.slug);
  if (!result || "unpublished" in result) {
    return { title: params.slug };
  }
  const { page } = result;
  // Per-page favicon — each page can set its own in Settings → Favicon.
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

// Thin per-prefix entrypoint for the /p route. The /ln, /tg and /ld routes
// call `renderPublicPage` with their own prefix so a page served on the wrong
// prefix can redirect to its canonical URL.
type PublicSearchParams = { [key: string]: string | string[] | undefined };

export default async function PublicPage(props: {
  params: { slug: string };
  searchParams?: PublicSearchParams;
}) {
  return renderPublicPage(props.params, "p", props.searchParams);
}

export async function renderPublicPage(
  params: { slug: string },
  routePrefix: PagePrefix,
  searchParams?: PublicSearchParams,
) {
  if (!params.slug) notFound();
  const result = await loadPage(params.slug);

  // Unpublished/paused page → bounce to the main site.
  if (result && "unpublished" in result) {
    redirect(process.env.NEXT_PUBLIC_APP_URL ?? "/");
  }

  if (!result) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          invoxai.io / p
        </p>
        <h1 className="mt-2 text-3xl font-sora font-semibold tracking-tight">
          {params.slug}
        </h1>
        <p className="mt-4 text-muted-foreground">
          This page isn&apos;t live yet. Check back soon.
        </p>
      </main>
    );
  }

  const { page, product, products: tierList, pixel } = result;

  // Canonical-prefix enforcement: each page has exactly one correct prefix
  // (/p payment, /ln landing, /tg telegram, /ld lead). If it's being served on
  // a different prefix, redirect to the canonical URL. Payment pages on /p
  // match and never redirect, so the checkout path is untouched.
  const canonical = pagePrefix(page.type, page.template_id);
  if (canonical !== routePrefix) {
    // Preserve query (?ref=, utm_*, product, etc.) across the canonical redirect
    // so affiliate attribution and deep-links survive.
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => qp.append(k, x));
      else qp.append(k, v);
    }
    const qs = qp.toString();
    redirect(
      publicPagePath(page.type, page.slug, page.template_id) +
        (qs ? `?${qs}` : ""),
    );
  }

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

  // A-side visitor counter when an experiment is live. Best-effort.
  try {
    if ((page as { experiment_status?: string }).experiment_status === "running") {
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

  // Resolve page-level order bump into runtime form.
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
      <PageSkin values={values as Record<string, unknown>}>
        <CheckoutConfigProvider
          config={checkoutConfigFromValues(values as Record<string, unknown>)}
        >
          <template.Render
            values={values}
            pageId={page.id}
            slug={page.slug}
            product={product}
            products={tierList}
            bumpRuntime={bumpRuntime}
          />
        </CheckoutConfigProvider>
      </PageSkin>
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
      <WishlistButton pageId={page.id} />
      <PixelScripts pixel={pixel} />
      {/* First-party PageView/ViewContent beacon — beacon-only (PixelScripts
          above already injects the page-level Meta/Google pixels). */}
      <TrackingProvider
        sellerId={page.user_id as string}
        pageType="payment"
        pixels={null}
        viewContent={product ? { productId: product.id, value: Number(product.price) } : null}
      />
      <ReferralTracker slug={page.slug} />
    </>
  );
}

// Pixel injection now lives in components/pages/PixelScripts.tsx — the
// imported PixelScripts component handles every platform via
// document.head.appendChild on the client.
