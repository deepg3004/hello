// Phase 15 — first-party event helpers (client). These record events into our
// OWN store (/api/tracking/event) so the analytics dashboard has Purchase /
// Lead / click data. They deliberately do NOT fire Meta/Google pixels — that
// stays in lib/pixel-events.ts + CheckoutForm so we never double-count a
// conversion on the ad platforms.

declare global {
  interface Window {
    /** Set by <TrackingProvider> so any client widget on a tracked page can
     *  fire events without threading the seller id through props. */
    __INVOX_SELLER__?: string | null;
  }
}

function resolveSeller(explicit?: string | null): string | null {
  if (explicit) return explicit;
  if (typeof window !== "undefined") return window.__INVOX_SELLER__ ?? null;
  return null;
}

export interface TrackOptions {
  sellerId?: string | null;
  pageType?: string;
  value?: number;
  currency?: string;
  orderId?: string;
  productId?: string;
  meta?: Record<string, unknown>;
}

/** Fire-and-forget first-party event beacon. No-op without a seller id. */
export function trackEvent(eventName: string, opts: TrackOptions = {}): void {
  if (typeof window === "undefined") return;
  const sellerId = resolveSeller(opts.sellerId);
  if (!sellerId) return;
  try {
    const q = new URLSearchParams(location.search);
    const body = JSON.stringify({
      seller_id: sellerId,
      event_name: eventName,
      page_type: opts.pageType,
      path: location.pathname,
      referrer: document.referrer || null,
      utm_source: q.get("utm_source"),
      utm_medium: q.get("utm_medium"),
      utm_campaign: q.get("utm_campaign"),
      utm_content: q.get("utm_content"),
      utm_term: q.get("utm_term"),
      event_value: opts.value,
      currency: opts.currency,
      order_id: opts.orderId,
      product_id: opts.productId,
      meta: opts.meta,
    });
    fetch("/api/tracking/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw into the caller */
  }
}

export function trackPurchase(opts: {
  sellerId?: string | null;
  value: number;
  currency?: string;
  orderId: string;
}): void {
  trackEvent("Purchase", {
    sellerId: opts.sellerId,
    value: opts.value,
    currency: opts.currency,
    orderId: opts.orderId,
  });
}

export function trackLead(opts: TrackOptions = {}): void {
  trackEvent("Lead", opts);
}

/** Click on an outbound contact button (WhatsApp / Telegram / etc.). */
export function trackClick(eventName: string, opts: TrackOptions = {}): void {
  trackEvent(eventName, opts);
}
