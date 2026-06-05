"use client";

import { useEffect } from "react";

/** Fires a one-shot beacon recording this storefront page view + its click
 *  source (the ?from= the header logo adds, plus external referrer). */
export function StorefrontTracker({ sellerId }: { sellerId: string }) {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const payload = JSON.stringify({
        seller_id: sellerId,
        path: url.pathname,
        source: url.searchParams.get("from"),
        referrer: document.referrer ? new URL(document.referrer).host : null,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/storefront/track", new Blob([payload], { type: "application/json" }));
      } else {
        void fetch("/api/storefront/track", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true });
      }
    } catch {
      /* never block the page on analytics */
    }
  }, [sellerId]);
  return null;
}
