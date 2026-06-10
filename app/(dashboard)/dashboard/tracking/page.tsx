import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { loadMarketing } from "@/lib/marketing";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { TrackingDashboard } from "@/components/dashboard/TrackingDashboard";

export const metadata = { title: "Ads Tracking" };
export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const ctx = await requirePageActor("marketing.view", "/dashboard/tracking");
  const admin = createAdminClient();

  const m = await loadMarketing(ctx.ownerId, admin);

  // Pixel Health — read straight from the first-party event store.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ data: lastEv }, todayRes] = await Promise.all([
    admin
      .from("storefront_events")
      .select("created_at, event_name")
      .eq("seller_user_id", ctx.ownerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("storefront_events")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", ctx.ownerId)
      .gte("created_at", startOfToday.toISOString()),
  ]);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Ads Tracking"
        blurb="Connect your Meta Pixel and Google Analytics so every visit, lead and sale on your pages is tracked for retargeting and conversion optimization."
        resourcesHref={null}
      />
      <TrackingDashboard
        initial={{
          meta_pixel_id: m?.meta_pixel_id ?? "",
          ga4_id: m?.ga4_id ?? "",
          enable_meta_pixel: m?.enable_meta_pixel ?? true,
          enable_ga4: m?.enable_ga4 ?? true,
          enable_advanced_matching: m?.enable_advanced_matching ?? false,
        }}
        health={{
          lastEventAt: (lastEv?.created_at as string | undefined) ?? null,
          lastEventName: (lastEv?.event_name as string | undefined) ?? null,
          eventsToday: todayRes.count ?? 0,
        }}
      />
    </div>
  );
}
