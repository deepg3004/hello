import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import { resolveSurfaceConfig, resolveChromeConfig } from "@/lib/storefront-theme";
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

  const store = resolveSurfaceConfig(profile?.storefront_config, "store");
  const course = resolveSurfaceConfig(profile?.storefront_config, "course");
  const chrome = resolveChromeConfig(profile?.storefront_config);
  const storeUrl = profile?.subdomain
    ? `https://${profile.subdomain}.${platformRootDomain()}`
    : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Storefront design"
        blurb="Pick a premium theme and tailor every detail of your store and course pages — colors, fonts, layout, sections and copy. Changes go live instantly."
        gradient="from-amber-500 via-orange-500 to-rose-500"
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "60ms" }}>
        <StorefrontDesigner store={store} course={course} chrome={chrome} storeUrl={storeUrl} />
      </div>
    </div>
  );
}
