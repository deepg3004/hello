"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import type { MarketingEvent } from "@/lib/marketing";

interface Result {
  ok: boolean;
  message?: string;
}

const ALL_EVENTS: MarketingEvent[] = [
  "order_paid",
  "lead_created",
  "booking_created",
];

export async function saveMarketingIntegrationsAction(input: {
  meta_pixel_id?: string | null;
  ga4_id?: string | null;
  google_ads_id?: string | null;
  tiktok_pixel_id?: string | null;
  custom_head_html?: string | null;
  webhook_url?: string | null;
  webhook_events?: string[];
  active?: boolean;
}): Promise<Result> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const url = input.webhook_url?.trim() || null;
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false, message: "Webhook URL must start with http(s)://" };
  }
  const events = (input.webhook_events ?? ALL_EVENTS).filter((e) =>
    (ALL_EVENTS as string[]).includes(e),
  );

  const admin = createAdminClient();
  const { error } = await admin.from("marketing_integrations").upsert(
    {
      user_id: ctx.ownerId,
      meta_pixel_id: input.meta_pixel_id?.trim() || null,
      ga4_id: input.ga4_id?.trim() || null,
      google_ads_id: input.google_ads_id?.trim() || null,
      tiktok_pixel_id: input.tiktok_pixel_id?.trim() || null,
      custom_head_html: input.custom_head_html?.trim() || null,
      webhook_url: url,
      webhook_events: events.length ? events : ALL_EVENTS,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/marketing");
  return { ok: true };
}

/**
 * S13 — "Test pixel": fire a one-off test event to the seller's configured
 * outbound webhook so they can confirm their Zapier/Make/CRM endpoint receives
 * InvoxAI events. (Client-side pixels — Meta/GA4/TikTok — are validated in their
 * own dashboards; the server-side integration we can actually test is the
 * webhook.)
 */
export async function testPixelAction(): Promise<Result> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("marketing_integrations")
    .select("webhook_url")
    .eq("user_id", ctx.ownerId)
    .maybeSingle();

  const url = cfg?.webhook_url?.trim();
  if (!url) {
    return { ok: false, message: "No outbound webhook URL configured to test." };
  }

  // SSRF guard — block private/loopback/metadata targets.
  try {
    const { assertPublicHttpUrl } = await import("@/lib/safe-url");
    await assertPublicHttpUrl(url);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unsafe URL" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "test",
        source: "invoxai",
        message: "Test event from your InvoxAI Marketing Integrations.",
        sent_at: new Date().toISOString(),
      }),
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, message: `Endpoint responded ${res.status}.` };
    }
    return { ok: true, message: "Test event delivered." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? `Delivery failed: ${e.message}` : "Delivery failed.",
    };
  }
}
