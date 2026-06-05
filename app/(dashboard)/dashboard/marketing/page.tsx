// /dashboard/marketing — account-wide Marketing Integrations (Session 13):
// site-wide tracking pixels + an outbound webhook for order/lead/booking events.

import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { loadMarketing } from "@/lib/marketing";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  MarketingForm,
  type MarketingState,
} from "@/components/dashboard/marketing/MarketingForm";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const ctx = await requirePageActor("marketing.view", "/dashboard/marketing");

  const m = await loadMarketing(ctx.ownerId);
  const initial: MarketingState | null = m
    ? {
        meta_pixel_id: m.meta_pixel_id,
        ga4_id: m.ga4_id,
        google_ads_id: m.google_ads_id,
        tiktok_pixel_id: m.tiktok_pixel_id,
        custom_head_html: m.custom_head_html,
        webhook_url: m.webhook_url,
        webhook_events: m.webhook_events ?? [],
        active: m.active,
      }
    : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Marketing Integrations"
        blurb="Connect tracking pixels and an outbound webhook — applied across your storefront, website and checkout."
        gradient="from-orange-600 via-amber-600 to-yellow-600"
      />
      <MarketingForm initial={initial} />
    </div>
  );
}
