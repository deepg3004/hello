// =============================================================================
// Client-side pixel-event helpers.
//
// Every helper is safe to call even when the corresponding pixel hasn't been
// configured / hasn't loaded yet — they look up the global (fbq / gtag /
// ttq) and quietly no-op otherwise.
// =============================================================================

declare global {
  interface Window {
    fbq?: (
      action: "track" | "trackCustom" | "init" | "consent",
      eventName: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
    gtag?: (
      command: "event" | "config" | "set" | "js",
      action: string,
      params?: Record<string, unknown>,
    ) => void;
    ttq?: {
      track: (event: string, params?: Record<string, unknown>) => void;
      page?: () => void;
    };
    clarity?: (command: string, ...args: unknown[]) => void;
  }
}

// ---------------------------------------------------------------------------
// Meta (Facebook) Pixel
// ---------------------------------------------------------------------------

export interface PurchaseEventArgs {
  /** Order amount in major units (₹). */
  value: number;
  currency?: string;
  order_id: string;
  /** When omitted, defaults to a deterministic id based on order_id so the
   *  CAPI server-side fire dedups against the client-side fire on Meta's end. */
  event_id?: string;
}

export function fireMetaPurchaseEvent(
  pixelId: string | null | undefined,
  args: PurchaseEventArgs,
): void {
  if (!pixelId) return;
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq(
      "track",
      "Purchase",
      {
        value: args.value,
        currency: args.currency ?? "INR",
        order_id: args.order_id,
      },
      { eventID: args.event_id ?? defaultEventId("purchase", args.order_id) },
    );
  } catch (e) {
    console.warn("[pixel] meta purchase fire failed", e);
  }
}

export interface LeadEventArgs {
  lead_id?: string;
  /** Form name / page slug — Meta surfaces it in the dashboard. */
  content_name?: string;
  /** Set when the lead magnet had a price. */
  value?: number;
  currency?: string;
}

export function fireMetaLeadEvent(
  pixelId: string | null | undefined,
  args: LeadEventArgs,
): void {
  if (!pixelId) return;
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq(
      "track",
      "Lead",
      {
        content_name: args.content_name,
        value: args.value,
        currency: args.currency ?? "INR",
      },
      args.lead_id
        ? { eventID: defaultEventId("lead", args.lead_id) }
        : undefined,
    );
  } catch (e) {
    console.warn("[pixel] meta lead fire failed", e);
  }
}

// ---------------------------------------------------------------------------
// Google Ads
// ---------------------------------------------------------------------------

export interface GoogleConversionArgs {
  value: number;
  currency?: string;
  transaction_id?: string;
}

export function fireGoogleConversion(
  tagId: string | null | undefined,
  label: string | null | undefined,
  args: GoogleConversionArgs,
): void {
  if (!tagId || !label) return;
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", "conversion", {
      send_to: `${tagId}/${label}`,
      value: args.value,
      currency: args.currency ?? "INR",
      transaction_id: args.transaction_id,
    });
  } catch (e) {
    console.warn("[pixel] google conversion fire failed", e);
  }
}

/**
 * For lead pages: same plumbing as a purchase conversion but Meta-side we
 * also send a Lead event; here we keep it as a generic "conversion" so
 * Google Ads attribution lines up against the lead-form goal the seller
 * configured.
 */
export function fireGoogleLeadConversion(
  tagId: string | null | undefined,
  label: string | null | undefined,
  args: GoogleConversionArgs,
): void {
  fireGoogleConversion(tagId, label, args);
}

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------

export function fireTikTokPurchase(
  pixelId: string | null | undefined,
  args: PurchaseEventArgs,
): void {
  if (!pixelId) return;
  if (typeof window === "undefined" || !window.ttq?.track) return;
  try {
    window.ttq.track("CompletePayment", {
      value: args.value,
      currency: args.currency ?? "INR",
      content_type: "product",
      content_id: args.order_id,
    });
  } catch (e) {
    console.warn("[pixel] tiktok purchase fire failed", e);
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function defaultEventId(kind: "purchase" | "lead", id: string): string {
  return `invoxai_${kind}_${id}`;
}

export function makeMetaEventId(
  kind: "purchase" | "lead",
  id: string,
): string {
  return defaultEventId(kind, id);
}
