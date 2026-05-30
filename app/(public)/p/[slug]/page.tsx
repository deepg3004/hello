import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";

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
    .select("meta_pixel_id, google_ads_id, google_ads_label, tiktok_pixel_id, hotjar_id")
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
  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    openGraph: {
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? undefined,
      images: page.meta_image_url ? [{ url: page.meta_image_url }] : undefined,
    },
  };
}

export default async function PublicPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!params.slug) notFound();
  const result = await loadPage(params.slug);

  if (!result) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          invoxai.io / p
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {params.slug}
        </h1>
        <p className="mt-4 text-muted-foreground">
          This page isn&apos;t live yet. Check back soon.
        </p>
      </main>
    );
  }

  const { page, product, pixel } = result;
  const template = getTemplate(page.template_id);

  if (!template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
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
    </>
  );
}

function PixelScripts({ pixel }: { pixel: PixelRow | null | undefined }) {
  if (!pixel) return null;
  return (
    <>
      {pixel.meta_pixel_id && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel.meta_pixel_id}');fbq('track','PageView');`}
          </Script>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixel.meta_pixel_id}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {pixel.google_ads_id && (
        <>
          <Script
            id="gads-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${pixel.google_ads_id}`}
          />
          <Script id="gads-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${pixel.google_ads_id}');`}
          </Script>
        </>
      )}

      {pixel.tiktok_pixel_id && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixel.tiktok_pixel_id}');ttq.page();}(window, document, 'ttq');`}
        </Script>
      )}

      {pixel.hotjar_id && (
        <Script id="hotjar" strategy="afterInteractive">
          {`(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${pixel.hotjar_id},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
        </Script>
      )}
    </>
  );
}
