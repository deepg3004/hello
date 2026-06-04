// Server-side loaders for the seller website builder (subdomain / custom domain).

import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import type { SiteProductLite } from "@/components/templates/blocks/registry";
import type { SiteNavPage } from "@/components/site/SiteRenderer";

export interface SellerSite {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  tagline: string | null;
  brand_color: string | null;
  social_links: Record<string, string> | null;
  theme: string | null;
  font: string | null;
  footer_text: string | null;
  footer_links: Array<{ label: string; url: string }>;
  footer_columns: Array<{ title: string; links: Array<{ label: string; url: string }> }>;
  favicon: string | null;
  og_image: string | null;
}

/** Resolve a seller by their subdomain handle, with branding. */
export async function loadSellerSite(username: string): Promise<SellerSite | null> {
  noStore(); // always read fresh — branding/theme must reflect edits immediately
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, legal_business_name, avatar_url, bio, tagline, brand_color, social_links, site_config",
    )
    .eq("subdomain", username)
    .maybeSingle();
  if (!data?.id) return null;
  const siteConfig = (data.site_config as Record<string, unknown>) ?? {};
  return {
    id: data.id,
    name: data.legal_business_name ?? data.full_name ?? username,
    avatar: data.avatar_url ?? null,
    bio: data.bio ?? null,
    tagline: data.tagline ?? null,
    brand_color: data.brand_color ?? null,
    social_links: (data.social_links as Record<string, string>) ?? null,
    theme: (siteConfig.theme as string) ?? null,
    font: (siteConfig.font as string) ?? null,
    footer_text: (siteConfig.footer_text as string) ?? null,
    footer_links: Array.isArray(siteConfig.footer_links)
      ? (siteConfig.footer_links as Array<{ label: string; url: string }>)
      : [],
    footer_columns: Array.isArray(siteConfig.footer_columns)
      ? (siteConfig.footer_columns as Array<{
          title: string;
          links: Array<{ label: string; url: string }>;
        }>)
      : [],
    favicon: (siteConfig.favicon as string) ?? null,
    og_image: (siteConfig.og_image as string) ?? null,
  };
}

/** Published site pages for the top nav, ordered. */
export async function loadNavPages(userId: string): Promise<SiteNavPage[]> {
  noStore();
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_pages")
    .select("slug, title, nav_label, is_home, show_in_nav, status, sort_order")
    .eq("user_id", userId)
    .eq("status", "published")
    .eq("show_in_nav", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((p) => ({
    slug: p.slug,
    label: p.nav_label ?? p.title,
    isHome: p.is_home,
  }));
}

/** The seller's live products (active + on a published page) for the products block. */
export async function loadSellerProducts(userId: string): Promise<SiteProductLite[]> {
  noStore();
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select(
      "id, name, description, image_url, price, original_price, is_popular, sort_order, pages!products_page_id_fkey(slug, status)",
    )
    .eq("user_id", userId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? [])
    .map((r) => {
      const rel = (r as { pages?: { slug: string; status: string } | { slug: string; status: string }[] | null }).pages;
      const page = (Array.isArray(rel) ? rel[0] : rel) ?? null;
      if (!page || page.status !== "published") return null;
      return {
        id: String(r.id),
        name: String(r.name ?? "Untitled"),
        description: (r.description as string | null) ?? null,
        image_url: (r.image_url as string | null) ?? null,
        price: Number(r.price ?? 0),
        original_price: r.original_price != null ? Number(r.original_price) : null,
        is_popular: !!r.is_popular,
        slug: page.slug,
      } satisfies SiteProductLite;
    })
    .filter(Boolean) as SiteProductLite[];
}

/** The seller's linkable pages (for the in-editor page picker): store home,
 *  published pages, and published courses — as branded subdomain URLs. */
export async function loadSellerLinks(
  userId: string,
): Promise<Array<{ label: string; url: string; group: string }>> {
  noStore();
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subdomain")
    .eq("id", userId)
    .single();
  const base = profile?.subdomain
    ? `https://${profile.subdomain}.${platformRootDomain()}`
    : "";
  const out: Array<{ label: string; url: string; group: string }> = [];
  if (base) out.push({ group: "Store", label: "Store home", url: base });

  const { data: pages } = await admin
    .from("pages")
    .select("title, slug, status")
    .eq("user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  for (const p of pages ?? []) {
    out.push({
      group: "Pages",
      label: (p.title as string) || (p.slug as string),
      url: base ? `${base}/${p.slug}` : `/${p.slug}`,
    });
  }

  const { data: courses } = await admin
    .from("courses")
    .select("id, title, status")
    .eq("seller_user_id", userId)
    .eq("status", "published");
  for (const c of courses ?? []) {
    out.push({
      group: "Courses",
      label: (c.title as string) || "Course",
      url: base ? `${base}/course/${c.id}` : `/course/${c.id}`,
    });
  }
  return out;
}

/** A published site page by slug for a seller, or null. */
export async function loadSitePage(
  userId: string,
  opts: { slug?: string; home?: boolean },
): Promise<{
  blocks: unknown;
  seo_title: string | null;
  seo_description: string | null;
  title: string;
  slug: string;
} | null> {
  noStore();
  const admin = createAdminClient();
  let q = admin
    .from("site_pages")
    .select("blocks, seo_title, seo_description, title, slug")
    .eq("user_id", userId)
    .eq("status", "published");
  q = opts.home ? q.eq("is_home", true) : q.eq("slug", opts.slug ?? "");
  const { data } = await q.maybeSingle();
  return data ?? null;
}
