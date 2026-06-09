// Shopify-style storefront catalog at <subdomain>/store. Lists every active
// catalog product (published page) with search, category filter, price range,
// sort and ratings. Cart + checkout reuse the existing CartProvider/CartDrawer.

import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewSummaries, getSellerTestimonials } from "@/lib/reviews";
import { resolveSurfaceConfig, resolveChromeConfig } from "@/lib/storefront-theme";
import { topSellingProductIds } from "@/lib/storefront-sections";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { StorefrontShell, PromoBanner } from "@/components/store/StorefrontShell";
import { StorefrontBanners } from "@/components/store/StorefrontBanners";
import { StoreCatalog } from "@/components/store/StoreCatalog";
import { TestimonialsSection } from "@/components/store/TestimonialsSection";
import { FaqSection } from "@/components/store/FaqSection";
import { FeaturesSection } from "@/components/store/FeaturesSection";
import { BrandLogoSlider } from "@/components/store/BrandLogoSlider";
import { ProductCard, type CatalogItem } from "@/components/store/ProductCard";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  noStore();
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("user_profiles")
    .select("legal_business_name, full_name, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  const cfg = resolveSurfaceConfig(p?.storefront_config, "store");
  const name = p?.legal_business_name ?? p?.full_name ?? params.username;
  return {
    title: cfg.title.trim() || `${name} — Store`,
    icons: cfg.favicon ? { icon: cfg.favicon } : undefined,
  };
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
  noStore();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, avatar_url, tagline, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "store");
  const chrome = resolveChromeConfig(profile.storefront_config);

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

  // Top-selling row (by paid sales), mapped to the loaded items in rank order.
  let topItems: CatalogItem[] = [];
  if (cfg.sections.topSelling && items.length > 0) {
    const byId = new Map(items.map((p) => [p.id, p]));
    topItems = (await topSellingProductIds(profile.id, 8))
      .map((id) => byId.get(id))
      .filter((p): p is CatalogItem => !!p);
  }

  // Testimonials: seller-curated when present, else auto-fill with real
  // verified reviews so the section never sits empty.
  const testimonialItems =
    cfg.sections.testimonials && chrome.testimonials.length === 0
      ? await getSellerTestimonials(profile.id)
      : chrome.testimonials;

  return (
    <CartProvider username={params.username} sellerId={profile.id}>
      <StorefrontShell cfg={cfg} chrome={chrome} brandName={sellerName} sellerId={profile.id} username={params.username}>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <StorefrontBanners banners={cfg.banners} autoplay={cfg.bannerAutoplay} />
          <PromoBanner cfg={cfg} />

          {cfg.sections.features && <FeaturesSection items={chrome.features} align={cfg.sectionAlign} />}

          {topItems.length > 0 && (
            <section className="mb-10">
              <h2 className="sf-display mb-4 text-xl font-bold tracking-tight">🔥 Top selling</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {topItems.map((p) => (
                  <ProductCard key={p.id} p={p} base="/store" cardStyle={cfg.card} showRatings={cfg.sections.ratings} showBadges={cfg.sections.badges} />
                ))}
              </div>
            </section>
          )}

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
              cols={cfg.cols}
            />
          )}

          {cfg.sections.testimonials && <TestimonialsSection items={testimonialItems} align={cfg.sectionAlign} />}
          {cfg.sections.brands && <BrandLogoSlider logos={chrome.brandLogos} />}
          {cfg.sections.faq && <FaqSection items={chrome.faqs} align={cfg.sectionAlign} />}
        </main>
      </StorefrontShell>
      <CartDrawer />
    </CartProvider>
  );
}
