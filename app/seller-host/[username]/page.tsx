// Seller "home" = their public STORE. Rendered at the root of a seller's
// subdomain (rahul.invoxai.io) or custom domain. Shows every active product
// from their published pages, grouped by category. Each card links to that
// product's checkout page (bare /<slug>, which middleware resolves on the
// subdomain).

import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAGE_CATEGORIES,
  pageMatchesCategory,
  type PageCategoryKey,
} from "@/lib/dashboard/page-categories";
import { resolveSurfaceConfig, resolveChromeConfig } from "@/lib/storefront-theme";
import { storefrontBasePath } from "@/lib/storefront-host";
import { withStorefrontBase } from "@/lib/storefront-base";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { StorefrontShell, PromoBanner } from "@/components/store/StorefrontShell";
import { StorefrontBanners } from "@/components/store/StorefrontBanners";
import {
  StoreGrid,
  type StoreProduct,
  type StoreSection,
} from "@/components/store/StoreGrid";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import {
  loadSellerSite,
  loadSitePage,
  loadNavPages,
  loadSellerProducts,
} from "@/lib/site";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const site = await loadSellerSite(params.username);
  if (!site) {
    // No website-builder site — fall back to the store design's title/favicon.
    const admin = createAdminClient();
    const { data: p } = await admin
      .from("user_profiles")
      .select("legal_business_name, full_name, storefront_config")
      .eq("subdomain", params.username)
      .maybeSingle();
    const cfg = resolveSurfaceConfig(p?.storefront_config, "home");
    const name = p?.legal_business_name ?? p?.full_name ?? params.username;
    return {
      title: cfg.title.trim() || name,
      icons: cfg.favicon ? { icon: cfg.favicon } : undefined,
    };
  }
  const icons = site.favicon ? { icon: site.favicon } : undefined;
  const home = await loadSitePage(site.id, { home: true });
  if (home) {
    return {
      title: home.seo_title ?? site.name,
      description: home.seo_description ?? site.tagline ?? undefined,
      icons,
      openGraph: site.og_image ? { images: [{ url: site.og_image }] } : undefined,
    };
  }
  return { title: `${site.name} — Store`, icons };
}

type PageJoin = {
  slug: string;
  type: string | null;
  template_id: string | null;
  status: string | null;
};

// Catalog section order.
const SECTION_ORDER: PageCategoryKey[] = ["payment", "telegram", "landing", "leads"];

export default async function SellerStore({ params }: Props) {
  noStore();
  // If the seller has built + published a Home page in the website builder,
  // render that instead of the auto product store.
  const site = await loadSellerSite(params.username);
  if (!site) notFound();

  const home = await loadSitePage(site.id, { home: true });
  if (home) {
    const [products, navPages] = await Promise.all([
      loadSellerProducts(site.id),
      loadNavPages(site.id),
    ]);
    return (
      <SiteRenderer
        blocks={home.blocks}
        themeKey={site.theme}
        fontKey={site.font}
        brandColor={site.brand_color}
        seller={{ name: site.name, avatar: site.avatar }}
        socialLinks={site.social_links}
        tagline={site.tagline}
        footerText={site.footer_text}
        footerLinks={site.footer_links}
        footerColumns={site.footer_columns}
        products={products}
        navPages={navPages}
      />
    );
  }

  // Fallback: the auto-generated product store (themed by the seller's store
  // design so this main page reflects their chosen theme too).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, avatar_url, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "home");
  const chrome = resolveChromeConfig(profile.storefront_config);
  const base = storefrontBasePath(params.username);

  const { data: productsRaw } = await admin
    .from("products")
    .select(
      "id, name, description, image_url, price, original_price, is_popular, is_catalog, sort_order, page_id, pages!products_page_id_fkey(slug, type, template_id, status), product_variants(id, name, price, active, sort_order)",
    )
    .eq("user_id", profile.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  // Keep only products whose page is published; attach the page for grouping.
  const withPage = (productsRaw ?? [])
    .map((r) => {
      const rel = (r as { pages?: PageJoin | PageJoin[] | null }).pages;
      const page = (Array.isArray(rel) ? rel[0] : rel) ?? null;
      return page && page.status === "published" ? { row: r, page } : null;
    })
    .filter(Boolean) as { row: Record<string, unknown>; page: PageJoin }[];

  const sections: StoreSection[] = SECTION_ORDER.map((key) => {
    const products: StoreProduct[] = withPage
      .filter(({ page }) =>
        pageMatchesCategory({ type: page.type ?? "", template_id: page.template_id }, key),
      )
      .map(({ row, page }) => ({
        id: String(row.id),
        name: String(row.name ?? "Untitled"),
        description: (row.description as string | null) ?? null,
        image_url: (row.image_url as string | null) ?? null,
        price: Number(row.price ?? 0),
        original_price:
          row.original_price != null ? Number(row.original_price) : null,
        is_popular: !!row.is_popular,
        is_catalog: !!row.is_catalog,
        slug: page.slug,
        variants: ((row.product_variants as Array<{ id: string; name: string; price: number; active: boolean; sort_order: number }> | null) ?? [])
          .filter((v) => v.active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ id: v.id, name: v.name, price: Number(v.price ?? 0) })),
      }));
    return { key, label: PAGE_CATEGORIES[key].label, products };
  }).filter((s) => s.products.length > 0);

  const sellerName =
    profile.legal_business_name ?? profile.full_name ?? params.username;
  const totalProducts = sections.reduce((n, s) => n + s.products.length, 0);

  // Active collections — quick links above the grid.
  const { data: colRaw } = await admin
    .from("collections")
    .select("name, slug")
    .eq("user_id", profile.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const storeCollections = (colRaw ?? []) as Array<{ name: string; slug: string }>;

  // Does the seller have any published courses? (drives the Courses link)
  const { count: courseCount } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("seller_user_id", profile.id)
    .eq("status", "published");
  const hasCourses = (courseCount ?? 0) > 0;

  return (
    <CartProvider username={params.username} sellerId={profile.id}>
    <StorefrontShell cfg={cfg} chrome={chrome} brandName={sellerName} sellerId={profile.id} username={params.username}>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <StorefrontBanners banners={cfg.banners} autoplay={cfg.bannerAutoplay} />
        <PromoBanner cfg={cfg} />

        {(totalProducts > 0 || hasCourses) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {totalProducts > 0 && (
              <a href={withStorefrontBase(base, "/store")} className="sf-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                Browse full store →
              </a>
            )}
            {hasCourses && (
              <a href={withStorefrontBase(base, "/course")} className="sf-btn-outline inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition hover:opacity-80">
                Courses →
              </a>
            )}
          </div>
        )}

        {storeCollections.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {storeCollections.map((c) => (
              <a key={c.slug} href={`/c/${c.slug}`} className="sf-chip px-3.5 py-1.5 text-sm font-medium transition hover:opacity-90">
                {c.name}
              </a>
            ))}
          </div>
        )}

        {totalProducts === 0 ? (
          <p className="sf-muted">No products live yet. Check back soon.</p>
        ) : (
          <StoreGrid sections={sections} cardStyle={cfg.card} showBadges={cfg.sections.badges} cols={cfg.cols} />
        )}
      </main>
    </StorefrontShell>
    <CartDrawer />
    </CartProvider>
  );
}
