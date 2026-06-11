// Resolves the seller for this host and injects their account-wide marketing
// pixels (Session 13) across the storefront + every site/product page rendered
// under /seller-host/[username]/*. Per-page pixels still layer on top.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadMarketing } from "@/lib/marketing";
import { MarketingScripts } from "@/components/marketing/MarketingScripts";
import { TrackingProvider } from "@/components/tracking/TrackingProvider";

export default async function SellerHostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  let sellerId: string | null = null;
  let pixels: {
    meta_pixel_id: string | null;
    ga4_id: string | null;
    custom_head_html: string | null;
  } | null = null;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("subdomain", params.username)
      .maybeSingle();
    if (profile?.id) {
      sellerId = profile.id as string;
      const m = await loadMarketing(profile.id, admin);
      if (m && m.active) {
        pixels = {
          meta_pixel_id: m.enable_meta_pixel ? m.meta_pixel_id : null,
          ga4_id: m.enable_ga4 ? m.ga4_id : null,
          custom_head_html: m.custom_head_html,
        };
      }
    }
  } catch {
    /* best-effort — never block the storefront on tracking config */
  }

  return (
    <>
      {pixels && <MarketingScripts pixels={pixels} />}
      {/* First-party PageView beacon for every storefront-host page (home,
          collections, product host). Beacon-only — MarketingScripts above
          handles pixel injection. Also sets window.__INVOX_SELLER__ so the
          AddToCart / InitiateCheckout widgets can fire first-party events. */}
      {sellerId && (
        <TrackingProvider sellerId={sellerId} pageType="storefront" pixels={null} />
      )}
      {children}
    </>
  );
}
