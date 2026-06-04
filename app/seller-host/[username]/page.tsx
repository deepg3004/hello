// Seller "home" = their public STORE. Rendered at the root of a seller's
// subdomain (rahul.invoxai.io) or custom domain. Shows every active product
// from their published pages, grouped by category. Each card links to that
// product's checkout page (bare /<slug>, which middleware resolves on the
// subdomain).

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAGE_CATEGORIES,
  pageMatchesCategory,
  type PageCategoryKey,
} from "@/lib/dashboard/page-categories";
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
  if (!site) return { title: params.username };
  const home = await loadSitePage(site.id, { home: true });
  if (home) {
    return {
      title: home.seo_title ?? site.name,
      description: home.seo_description ?? site.tagline ?? undefined,
    };
  }
  return { title: `${site.name} — Store` };
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
        brandColor={site.brand_color}
        seller={{ name: site.name, avatar: site.avatar }}
        socialLinks={site.social_links}
        products={products}
        navPages={navPages}
      />
    );
  }

  // Fallback: the auto-generated product store (unchanged behaviour).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, avatar_url")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const { data: productsRaw } = await admin
    .from("products")
    .select(
      "id, name, description, image_url, price, original_price, is_popular, sort_order, page_id, pages!products_page_id_fkey(slug, type, template_id, status)",
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
        slug: page.slug,
      }));
    return { key, label: PAGE_CATEGORIES[key].label, products };
  }).filter((s) => s.products.length > 0);

  const sellerName =
    profile.legal_business_name ?? profile.full_name ?? params.username;
  const totalProducts = sections.reduce((n, s) => n + s.products.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10 flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={sellerName}
            className="h-14 w-14 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-base font-semibold text-zinc-700">
            {(sellerName?.[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-sora text-2xl font-semibold tracking-tight">
            {sellerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalProducts > 0
              ? `${totalProducts} product${totalProducts === 1 ? "" : "s"} available`
              : `Store by ${sellerName}`}
          </p>
        </div>
      </div>

      {totalProducts === 0 ? (
        <p className="text-muted-foreground">
          No products live yet. Check back soon.
        </p>
      ) : (
        <StoreGrid sections={sections} />
      )}
    </main>
  );
}
