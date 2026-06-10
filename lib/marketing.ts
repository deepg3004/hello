// Account-wide Marketing Integrations (Session 13): load a seller's tracking
// config + fire their outbound webhook on key events. Server-only.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingEvent =
  | "order_paid"
  | "lead_created"
  | "booking_created";

export interface MarketingIntegrations {
  user_id: string;
  meta_pixel_id: string | null;
  ga4_id: string | null;
  google_ads_id: string | null;
  tiktok_pixel_id: string | null;
  custom_head_html: string | null;
  webhook_url: string | null;
  webhook_events: string[];
  active: boolean;
  // Phase 15 — per-provider enable toggles + status (migration 095).
  enable_meta_pixel: boolean;
  enable_ga4: boolean;
  enable_google_ads: boolean;
  enable_advanced_matching: boolean;
  enable_consent_mode: boolean;
  status: string;
}

const MARKETING_COLS =
  "user_id, meta_pixel_id, ga4_id, google_ads_id, tiktok_pixel_id, custom_head_html, webhook_url, webhook_events, active, enable_meta_pixel, enable_ga4, enable_google_ads, enable_advanced_matching, enable_consent_mode, status";

export async function loadMarketing(
  sellerId: string,
  client?: SupabaseClient,
): Promise<MarketingIntegrations | null> {
  const admin = client ?? createAdminClient();
  const { data } = await admin
    .from("marketing_integrations")
    .select(MARKETING_COLS)
    .eq("user_id", sellerId)
    .maybeSingle();
  return (data as MarketingIntegrations | null) ?? null;
}

/**
 * Fire the seller's outbound webhook for an event. Best-effort: never throws
 * into the caller, short timeout, only when active + subscribed to the event.
 */
export async function fireMarketingWebhook(
  sellerId: string,
  event: MarketingEvent,
  payload: Record<string, unknown>,
  client?: SupabaseClient,
): Promise<void> {
  try {
    const m = await loadMarketing(sellerId, client);
    if (!m || !m.active || !m.webhook_url) return;
    if (!m.webhook_events?.includes(event)) return;

    // SSRF guard: never let a seller-supplied URL hit internal/metadata hosts.
    const { assertPublicHttpUrl } = await import("@/lib/safe-url");
    await assertPublicHttpUrl(m.webhook_url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(m.webhook_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event,
          seller_id: sellerId,
          data: payload,
          sent_at: new Date().toISOString(),
        }),
        signal: controller.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error("[marketing] webhook failed", event, e);
  }
}
