"use client";

import { useEffect } from "react";

export interface PixelConfig {
  meta_pixel_id?: string | null;
  google_ads_id?: string | null;
  google_ads_label?: string | null;
  tiktok_pixel_id?: string | null;
  hotjar_id?: string | null;
  clarity_id?: string | null;
  /** Pro+ — already gated server-side. */
  custom_script?: string | null;
}

export interface PixelScriptsProps {
  pixel?: PixelConfig | null;
  /** True for the seller preview / staging pages where we don't want real
   *  ad events to fire. */
  disabled?: boolean;
}

/**
 * Mounts and injects ads / heatmap pixels into <head> on the client. We
 * deliberately avoid `dangerouslySetInnerHTML` in the server render so
 * blocked-pixel network calls can't slow down SSR + so the buyer's first
 * paint isn't tied to a third-party script.
 *
 * Idempotent: every injected script carries a data-invoxai attribute and we
 * bail if it's already on the page (page transitions in app router can
 * cause double-mount).
 */
declare global {
  interface Window {
    __INVOXAI_PIXEL__?: PixelConfig | null;
  }
}

export function PixelScripts({ pixel, disabled }: PixelScriptsProps) {
  useEffect(() => {
    if (disabled || !pixel) {
      if (typeof window !== "undefined") window.__INVOXAI_PIXEL__ = null;
      return;
    }
    // Stash the public IDs on window so CheckoutForm + LeadCaptureForm can
    // fire conversion events without re-fetching them.
    window.__INVOXAI_PIXEL__ = {
      meta_pixel_id: pixel.meta_pixel_id ?? null,
      google_ads_id: pixel.google_ads_id ?? null,
      google_ads_label: pixel.google_ads_label ?? null,
      tiktok_pixel_id: pixel.tiktok_pixel_id ?? null,
    };

    const cleanup: Array<() => void> = [];
    if (pixel.meta_pixel_id) cleanup.push(injectMeta(pixel.meta_pixel_id));
    if (pixel.google_ads_id) cleanup.push(injectGoogle(pixel.google_ads_id));
    if (pixel.tiktok_pixel_id) cleanup.push(injectTikTok(pixel.tiktok_pixel_id));
    if (pixel.hotjar_id) cleanup.push(injectHotjar(pixel.hotjar_id));
    if (pixel.clarity_id) cleanup.push(injectClarity(pixel.clarity_id));
    if (pixel.custom_script) cleanup.push(injectCustom(pixel.custom_script));

    return () => {
      cleanup.forEach((fn) => fn());
      if (typeof window !== "undefined") window.__INVOXAI_PIXEL__ = null;
    };
  }, [pixel, disabled]);

  return null;
}

/** Read the cached pixel config from window — used by checkout / lead forms. */
export function getRuntimePixelConfig(): PixelConfig | null {
  if (typeof window === "undefined") return null;
  return window.__INVOXAI_PIXEL__ ?? null;
}

// ---------------------------------------------------------------------------
// Internals — each injector returns a teardown function.
// ---------------------------------------------------------------------------

function injectInline(tag: string, source: string): () => void {
  const existing = document.head.querySelector(
    `script[data-invoxai="${tag}"]`,
  );
  if (existing) return () => undefined;
  const s = document.createElement("script");
  s.setAttribute("data-invoxai", tag);
  s.text = source;
  document.head.appendChild(s);
  return () => {
    if (s.parentNode) s.parentNode.removeChild(s);
  };
}

function injectExternal(tag: string, src: string): () => void {
  const existing = document.head.querySelector(
    `script[data-invoxai="${tag}"]`,
  );
  if (existing) return () => undefined;
  const s = document.createElement("script");
  s.setAttribute("data-invoxai", tag);
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
  return () => {
    if (s.parentNode) s.parentNode.removeChild(s);
  };
}

function injectMeta(pixelId: string): () => void {
  return injectInline(
    "meta-pixel",
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
  );
}

function injectGoogle(tagId: string): () => void {
  const a = injectExternal(
    "gads-loader",
    `https://www.googletagmanager.com/gtag/js?id=${tagId}`,
  );
  const b = injectInline(
    "gads-init",
    `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${tagId}');`,
  );
  return () => {
    a();
    b();
  };
}

function injectTikTok(pixelId: string): () => void {
  return injectInline(
    "tiktok-pixel",
    `!function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixelId}');ttq.page();}(window, document, 'ttq');`,
  );
}

function injectHotjar(hjId: string): () => void {
  return injectInline(
    "hotjar",
    `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${Number(hjId) || 0},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
  );
}

function injectClarity(siteId: string): () => void {
  return injectInline(
    "clarity",
    `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window, document, "clarity", "script", "${siteId}");`,
  );
}

// Custom script: the seller paste might or might not include the <script>
// wrapper. Strip the wrapper if present so we can install via createElement.
function injectCustom(raw: string): () => void {
  const trimmed = raw.trim();
  // Refuse to inject <script src=...> from the textarea — only inline allowed.
  // The seller can use Meta/Google/TikTok fields for hosted scripts.
  const stripped = trimmed
    .replace(/^<script[^>]*>/i, "")
    .replace(/<\/script>\s*$/i, "");
  if (!stripped) return () => undefined;
  return injectInline("custom-script", stripped);
}
