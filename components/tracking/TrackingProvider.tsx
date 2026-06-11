"use client";

import { useEffect } from "react";

import { MarketingScripts, type MarketingPixels } from "@/components/marketing/MarketingScripts";
import { trackEvent } from "@/lib/tracking/events";

export interface TrackingProviderProps {
  /** The seller/tenant whose pixels + events these are. */
  sellerId: string;
  /** payment / landing / lead / course / builder / store / checkout / success… */
  pageType: string;
  /** Tenant pixels (already toggle-gated server-side — pass null ids for off).
   *  Pass null on pages that already inject pixels (PixelScripts / a parent
   *  MarketingScripts) to keep this beacon-only and avoid double-firing Meta. */
  pixels?: MarketingPixels | null;
  /** Product context for a detail page — fires one first-party ViewContent
   *  alongside the PageView (for retargeting audiences). */
  viewContent?: { productId?: string | null; value?: number | null; currency?: string | null } | null;
  /** Seller preview / staging — inject nothing, fire no events. */
  disabled?: boolean;
}

/**
 * One mount point for a public page's tracking: injects the tenant's ad pixels
 * (via the existing MarketingScripts) AND fires a first-party PageView to
 * /api/tracking/event (which also mints the anonymous visitor/session cookie).
 * Pixel injection and our own analytics beacon are intentionally independent —
 * an ad-blocker killing fbq/gtag does not stop our first-party page-view count.
 */
export function TrackingProvider({
  sellerId,
  pageType,
  pixels,
  viewContent,
  disabled,
}: TrackingProviderProps) {
  const vcProductId = viewContent?.productId ?? null;
  const vcValue = viewContent?.value ?? null;
  const vcCurrency = viewContent?.currency ?? null;
  useEffect(() => {
    if (disabled || !sellerId || typeof window === "undefined") return;
    // Expose the seller id so click/conversion widgets on this page can fire
    // first-party events without threading it through props.
    window.__INVOX_SELLER__ = sellerId;
    // Fire at most once per path per load (app-router can double-mount).
    const key = `__invox_pv_${location.pathname}`;
    if ((window as unknown as Record<string, boolean>)[key]) return;
    (window as unknown as Record<string, boolean>)[key] = true;

    const q = new URLSearchParams(location.search);
    const payload = {
      seller_id: sellerId,
      event_name: "PageView",
      page_type: pageType,
      path: location.pathname,
      referrer: document.referrer || null,
      utm_source: q.get("utm_source"),
      utm_medium: q.get("utm_medium"),
      utm_campaign: q.get("utm_campaign"),
      utm_content: q.get("utm_content"),
      utm_term: q.get("utm_term"),
    };
    fetch("/api/tracking/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});

    // Product-detail pages also record a first-party ViewContent (once per
    // path, guarded by the same PageView dedupe above) for retargeting.
    if (vcProductId || vcValue != null) {
      trackEvent("ViewContent", {
        sellerId,
        pageType,
        productId: vcProductId ?? undefined,
        value: vcValue ?? undefined,
        currency: vcCurrency ?? undefined,
      });
    }
  }, [sellerId, pageType, disabled, vcProductId, vcValue, vcCurrency]);

  return <MarketingScripts pixels={pixels} disabled={disabled} />;
}
