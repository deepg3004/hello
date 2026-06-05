// Shopify-style storefront catalog at <subdomain>/store. Lists every active
// catalog product (published page) with search, category filter, price range,
// sort and ratings. Cart + checkout reuse the existing CartProvider/CartDrawer.

import { notFound } from "next/navigation";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewSummaries } from "@/lib/reviews";
import { resolveSurfaceConfig } from "@/lib/storefront-theme";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { StorefrontShell, PromoBanner } from "@/components/store/StorefrontShell";
import { StoreCatalog } from "@/components/store/StoreCatalog";
import type { CatalogItem } from "@/components/store/ProductCard";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  return { title: `Store — ${params.username}` };
}

interface PageJoin {
  slug: string;
  status: string | null;
}
interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  is_popular: boolean;
  category: string | null;
  stock: number | null;
  created_at: string;
  pages?: PageJoin | PageJoin[] | null;
  product_variants?: Array<{ id: string; name: string; price: number; active: boolean; sort_order: number }> | null;
}

export default async function StoreCatalogPage({ params }: Props) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, avatar_url, tagline, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "store");

  const { data: rows } = await admin
    .from("products")
    .select(
      "id, name, description, image_url, price, original_price, is_popular, category, stock, created_at, pages!products_page_id_fkey(slug, status), product_variants(id, name, price, active, sort_order)",
    )
    .eq("user_id", profile.id)
    .eq("is_catalog", true)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const published = ((rows ?? []) as ProductRow[]).filter((p) => {
    const page = Array.isArray(p.pages) ? p.pages[0] : p.pages;
    return page && page.status === "published";
  });

  const ratings = await getReviewSummaries(
    "product",
    published.map((p) => p.id),
  );

  const items: CatalogItem[] = published.map((p) => {
    const page = Array.isArray(p.pages) ? p.pages[0] : p.pages;
    const r = ratings.get(p.id);
    return {
      id: p.id,
      name: p.name ?? "Untitled",
      slug: page!.slug,
      description: p.description,
      image_url: p.image_url,
      price: Number(p.price ?? 0),
      original_price: p.original_price != null ? Number(p.original_price) : null,
      is_popular: !!p.is_popular,
      category: p.category,
      stock: p.stock,
      variants: (p.product_variants ?? [])
        .filter((v) => v.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({ id: v.id, name: v.name, price: Number(v.price ?? 0) })),
      rating: { average: r?.average ?? 0, count: r?.count ?? 0 },
    };
  });

  const categories = Array.from(
    new Set(items.map((i) => i.category).filter((c): c is string => !!c)),
  ).sort();

  const sellerName = profile.legal_business_name ?? profile.full_name ?? params.username;
  const headline = cfg.headline.trim() || sellerName;
  const tagline =
    cfg.tagline.trim() || profile.tagline || `${items.length} product${items.length === 1 ? "" : "s"} available`;

  return (
    <CartProvider username={params.username}>
      <StorefrontShell cfg={cfg}>
        {/* Themed hero */}
        <header className="sf-band sf-border border-b">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-12 sm:px-6">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={sellerName} className="h-16 w-16 rounded-full border-2 border-[var(--sf-accent)] object-cover" />
            ) : (
              <div className="sf-accent-bg flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold">
                {(sellerName?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="sf-display text-3xl font-bold tracking-tight sm:text-4xl">{headline}</h1>
              <p className="sf-muted mt-1.5 text-sm sm:text-base">{tagline}</p>
            </div>
            <Link href="/" className="sf-btn-outline ml-auto hidden px-4 py-2 text-sm font-medium transition hover:opacity-80 sm:inline-block">
              ← Home
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <PromoBanner cfg={cfg} />
          {items.length === 0 ? (
            <p className="sf-muted py-20 text-center">No products live yet. Check back soon.</p>
          ) : (
            <StoreCatalog
              items={items}
              categories={categories}
              base="/store"
              cardStyle={cfg.card}
              showRatings={cfg.sections.ratings}
              showBadges={cfg.sections.badges}
            />
          )}
        </main>
      </StorefrontShell>
      <CartDrawer />
    </CartProvider>
  );
}
