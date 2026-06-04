// Resolves the seller for this host and injects their account-wide marketing
// pixels (Session 13) across the storefront + every site/product page rendered
// under /seller-host/[username]/*. Per-page pixels still layer on top.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadMarketing } from "@/lib/marketing";
import { MarketingScripts } from "@/components/marketing/MarketingScripts";

export default async function SellerHostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
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
      const m = await loadMarketing(profile.id, admin);
      if (m && m.active) {
        pixels = {
          meta_pixel_id: m.meta_pixel_id,
          ga4_id: m.ga4_id,
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
      {children}
    </>
  );
}
