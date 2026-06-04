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
