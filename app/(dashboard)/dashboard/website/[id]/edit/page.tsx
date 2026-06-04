import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import { loadSellerProducts } from "@/lib/site";
import {
  SiteFullEditor,
  type EditorPage,
} from "@/components/dashboard/website/SiteFullEditor";

export const metadata = { title: "Edit page — Website" };

export default async function WebsitePageEditor({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/website/${params.id}/edit`);

  const admin = createAdminClient();
  const [{ data: page }, { data: profile }, products] = await Promise.all([
    admin
      .from("site_pages")
      .select("id, user_id, slug, title, nav_label, is_home, status, blocks, seo_title, seo_description")
      .eq("id", params.id)
      .single(),
    admin
      .from("user_profiles")
      .select("subdomain, full_name, legal_business_name, avatar_url, brand_color, social_links, site_config")
      .eq("id", user.id)
      .single(),
    loadSellerProducts(user.id),
  ]);

  if (!page) notFound();
  if (page.user_id !== user.id) redirect("/dashboard/website");

  const cfg = (profile?.site_config as Record<string, unknown>) ?? {};
  const previewMeta = {
    theme: (cfg.theme as string) ?? null,
    font: (cfg.font as string) ?? null,
    brandColor: profile?.brand_color ?? null,
    seller: {
      name:
        profile?.legal_business_name ??
        profile?.full_name ??
        profile?.subdomain ??
        "Your store",
      avatar: profile?.avatar_url ?? null,
    },
    socialLinks: (profile?.social_links as Record<string, string>) ?? null,
    products,
  };

  const base = profile?.subdomain
    ? `https://${profile.subdomain}.${platformRootDomain()}`
    : null;
  const publicUrl = base ? (page.is_home ? base : `${base}/${page.slug}`) : null;

  return (
    <SiteFullEditor
      page={page as EditorPage}
      preview={previewMeta}
      publicUrl={publicUrl}
    />
  );
}
