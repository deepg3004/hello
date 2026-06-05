import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import { resolveSurfaceConfig, resolveChromeConfig, SURFACES, type Surface, type SurfaceConfig } from "@/lib/storefront-theme";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { StorefrontDesigner } from "@/components/dashboard/StorefrontDesigner";

export const metadata = { title: "Storefront design" };

export default async function StorefrontDesignPage() {
  const ctx = await requirePageActor("store.view", "/dashboard/storefront-design");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subdomain, storefront_config")
    .eq("id", ctx.ownerId)
    .single();

  const configs = Object.fromEntries(
    SURFACES.map((s) => [s.key, resolveSurfaceConfig(profile?.storefront_config, s.key)]),
  ) as Record<Surface, SurfaceConfig>;
  const chrome = resolveChromeConfig(profile?.storefront_config);
  const storeUrl = profile?.subdomain
    ? `https://${profile.subdomain}.${platformRootDomain()}`
    : null;

  // Click-source analytics — last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await admin
    .from("storefront_events")
    .select("path, source, referrer")
    .eq("seller_user_id", ctx.ownerId)
    .gte("created_at", since)
    .limit(20000);
  const rows = (events ?? []) as Array<{ path: string | null; source: string | null; referrer: string | null }>;
  const tally = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) {
      const k = (v ?? "").trim();
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([key, count]) => ({ key, count }));
  };
  const analytics = {
    totalViews: rows.length,
    topSources: tally(rows.map((r) => r.source)),
    topDestinations: tally(rows.map((r) => r.path)),
    topReferrers: tally(rows.map((r) => r.referrer)),
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Storefront design"
        blurb="Pick a premium theme and tailor every detail of your store and course pages — colors, fonts, layout, sections and copy. Changes go live instantly."
        gradient="from-amber-500 via-orange-500 to-rose-500"
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "60ms" }}>
        <StorefrontDesigner configs={configs} chrome={chrome} storeUrl={storeUrl} analytics={analytics} />
      </div>
    </div>
  );
}
