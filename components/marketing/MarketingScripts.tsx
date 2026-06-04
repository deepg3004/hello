"use client";

import { useEffect } from "react";

export interface MarketingPixels {
  meta_pixel_id?: string | null;
  ga4_id?: string | null;
  custom_head_html?: string | null;
}

/**
 * Account-wide tracking pixels for a seller's storefront + site pages
 * (complements the per-page PixelScripts). Injects into <head> on the client,
 * idempotently. Disabled in seller preview to avoid firing real events.
 */
export function MarketingScripts({
  pixels,
  disabled,
}: {
  pixels?: MarketingPixels | null;
  disabled?: boolean;
}) {
  useEffect(() => {
    if (disabled || !pixels) return;

    const mark = (el: HTMLElement) => el.setAttribute("data-invoxai-mkt", "1");
    const has = (id: string) =>
      document.querySelector(`[data-invoxai-mkt-id="${id}"]`);

    // Meta Pixel
    if (pixels.meta_pixel_id && !has(`meta-${pixels.meta_pixel_id}`)) {
      const s = document.createElement("script");
      s.setAttribute("data-invoxai-mkt-id", `meta-${pixels.meta_pixel_id}`);
      mark(s);
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixels.meta_pixel_id}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }

    // Google Analytics 4
    if (pixels.ga4_id && !has(`ga4-${pixels.ga4_id}`)) {
      const lib = document.createElement("script");
      lib.async = true;
      lib.src = `https://www.googletagmanager.com/gtag/js?id=${pixels.ga4_id}`;
      lib.setAttribute("data-invoxai-mkt-id", `ga4-${pixels.ga4_id}`);
      mark(lib);
      document.head.appendChild(lib);
      const init = document.createElement("script");
      mark(init);
      init.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${pixels.ga4_id}');`;
      document.head.appendChild(init);
    }

    // Custom head HTML (Pro+, set server-side)
    if (pixels.custom_head_html && !has("custom-head")) {
      const wrap = document.createElement("div");
      wrap.innerHTML = pixels.custom_head_html;
      const holder = document.createElement("div");
      holder.setAttribute("data-invoxai-mkt-id", "custom-head");
      holder.style.display = "none";
      Array.from(wrap.childNodes).forEach((n) => holder.appendChild(n));
      document.head.appendChild(holder);
    }
  }, [pixels, disabled]);

  return null;
}
