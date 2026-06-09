// Shopify-style product detail at <subdomain>/store/<slug>. Gallery, variant +
// quantity buy panel (add-to-cart / buy-now), description, trust badges,
// related products and verified-buyer reviews.

import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewSummary, getReviewSummaries, listReviews, getSellerTestimonials } from "@/lib/reviews";
import { resolveSurfaceConfig, resolveChromeConfig } from "@/lib/storefront-theme";
import { storefrontBasePath } from "@/lib/storefront-host";
import { withStorefrontBase } from "@/lib/storefront-base";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { StorefrontShell } from "@/components/store/StorefrontShell";
import { TestimonialsSection } from "@/components/store/TestimonialsSection";
import { FaqSection } from "@/components/store/FaqSection";
import { BrandLogoSlider } from "@/components/store/BrandLogoSlider";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductBuyPanel, type BuyPanelProduct } from "@/components/store/ProductBuyPanel";
import { ReviewsSection } from "@/components/store/ReviewsSection";
import { TrustBadges } from "@/components/store/TrustBadges";
import { ProductCard, type CatalogItem } from "@/components/store/ProductCard";
import { Stars } from "@/components/store/Stars";

interface Props {
  params: { username: string; slug: string };
}

export const dynamic = "force-dynamic";

interface VariantRow {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  active: boolean;
  sort_order: number;
}
interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  is_popular: boolean;
  category: string | null;
  stock: number | null;
  requires_shipping: boolean | null;
  page_id: string;
  product_variants?: VariantRow[] | null;
  product_images?: { url: string; sort_order: number }[] | null;
}

export async function generateMetadata({ params }: Props) {
  noStore();
  const admin = createAdminClient();
  const [{ data: page }, { data: prof }] = await Promise.all([
    admin.from("pages").select("id, title").eq("slug", params.slug).maybeSingle(),
    admin.from("user_profiles").select("storefront_config").eq("subdomain", params.username).maybeSingle(),
  ]);
  // Product description + image for richer link previews / SEO.
  let description: string | null = null;
  let image: string | null = null;
  if (page?.id) {
    const { data: prod } = await admin
      .from("products")
      .select("description, image_url")
      .eq("page_id", page.id)
      .maybeSingle();
    description = prod?.description ?? null;
    image = prod?.image_url ?? null;
  }
  const cfg = resolveSurfaceConfig(prof?.storefront_config, "product");
  const title = page?.title ?? "Product";
  return {
    title,
    description: description ?? undefined,
    icons: cfg.favicon ? { icon: cfg.favicon } : undefined,
    openGraph: {
      title,
      description: description ?? undefined,
      type: "website" as const,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? ("summary_large_image" as const) : ("summary" as const),
      title,
      description: description ?? undefined,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  noStore();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, free_shipping_over, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "product");
  const chrome = resolveChromeConfig(profile.storefront_config);

  const { data: page } = await admin
    .from("pages")
    .select("id, status")
    .eq("user_id", profile.id)
    .eq("slug", params.slug)
    .maybeSingle();
  if (!page || page.status !== "published") notFound();

  const { data: prod } = await admin
    .from("products")
    .select(
      "id, user_id, name, description, image_url, price, original_price, is_popular, category, stock, requires_shipping, page_id, product_variants(id, name, price, stock, active, sort_order), product_images(url, sort_order)",
    )
    .eq("page_id", page.id)
    .eq("user_id", profile.id)
    .eq("is_catalog", true)
    .eq("active", true)
    .maybeSingle<ProductRow>();
  if (!prod) notFound();

  const variants = (prod.product_variants ?? [])
    .filter((v) => v.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const gallery = [
    prod.image_url,
    ...(prod.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order).map((i) => i.url),
  ].filter((u): u is string => !!u);

  const [summary, reviews] = await Promise.all([
    getReviewSummary("product", prod.id),
    listReviews("product", prod.id, 30),
  ]);

  // Related — same category, else any other catalog product.
  const { data: relRows } = await admin
    .from("products")
    .select(
      "id, name, description, image_url, price, original_price, is_popular, category, stock, pages!products_page_id_fkey(slug, status), product_variants(id, name, price, active, sort_order)",
    )
    .eq("user_id", profile.id)
    .eq("is_catalog", true)
    .eq("active", true)
    .neq("id", prod.id)
    .limit(12);
  type RelRow = {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    original_price: number | null;
    is_popular: boolean;
    category: string | null;
    stock: number | null;
    pages?: { slug: string; status: string | null } | { slug: string; status: string | null }[] | null;
    product_variants?: Array<{ id: string; name: string; price: number; active: boolean; sort_order: number }> | null;
  };
  const relPublished = ((relRows ?? []) as RelRow[]).filter((r) => {
    const pg = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    return pg && pg.status === "published";
  });
  const sameCat = relPublished.filter((r) => prod.category && r.category === prod.category);
  const related = (sameCat.length > 0 ? sameCat : relPublished).slice(0, 4);
  const relRatings = await getReviewSummaries("product", related.map((r) => r.id));
  const relatedItems: CatalogItem[] = related.map((r) => {
    const pg = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    const rr = relRatings.get(r.id);
    return {
      id: r.id,
      name: r.name ?? "Untitled",
      slug: pg!.slug,
      description: r.description,
      image_url: r.image_url,
      price: Number(r.price ?? 0),
      original_price: r.original_price != null ? Number(r.original_price) : null,
      is_popular: !!r.is_popular,
      category: r.category,
      stock: r.stock,
      variants: (r.product_variants ?? [])
        .filter((v) => v.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({ id: v.id, name: v.name, price: Number(v.price ?? 0) })),
      rating: { average: rr?.average ?? 0, count: rr?.count ?? 0 },
    };
  });

  const buyProduct: BuyPanelProduct = {
    product_id: prod.id,
    name: prod.name ?? "Product",
    price: Number(prod.price ?? 0),
    original_price:
      prod.original_price != null && Number(prod.original_price) > 0
        ? Number(prod.original_price)
        : null,
    image_url: prod.image_url,
    slug: params.slug,
    stock: prod.stock,
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: Number(v.price ?? 0),
      stock: v.stock,
    })),
  };

  const sellerName = profile.legal_business_name ?? profile.full_name ?? params.username;

  // Testimonials: seller-curated when present, else real verified reviews.
  const testimonialItems =
    cfg.sections.testimonials && chrome.testimonials.length === 0
      ? await getSellerTestimonials(profile.id)
      : chrome.testimonials;

  return (
    <CartProvider username={params.username} sellerId={profile.id}>
      <StorefrontShell cfg={cfg} chrome={chrome} brandName={sellerName} sellerId={profile.id} username={params.username} hideBottomNav>
        <main className="mx-auto max-w-5xl px-4 pt-8 pb-40 sm:px-6 md:pb-8">
          <nav className="sf-muted mb-6 text-sm">
            <Link href={withStorefrontBase(storefrontBasePath(params.username), "/store")} className="transition hover:opacity-80">
              Store
            </Link>
            <span className="mx-2">/</span>
            <span style={{ color: "var(--sf-fg)" }}>{prod.name}</span>
          </nav>

          <div className="grid gap-8 md:grid-cols-2">
            <ProductGallery images={gallery} alt={prod.name ?? "Product"} />

            <div className="space-y-5">
              {prod.category && (
                <span className="sf-accent text-xs font-semibold uppercase tracking-wider">{prod.category}</span>
              )}
              <h1 className="sf-display text-2xl font-bold tracking-tight sm:text-3xl">{prod.name}</h1>

              {cfg.sections.ratings && summary.count > 0 && (
                <a href="#reviews" className="flex items-center gap-2 text-sm">
                  <Stars value={summary.average} size={16} />
                  <span className="font-medium">{summary.average.toFixed(1)}</span>
                  <span className="sf-muted">· {summary.count} review{summary.count === 1 ? "" : "s"}</span>
                </a>
              )}

              {/* Price (with strike-through "was" + % off) is rendered inside
                  the buy panel so it stays in sync with the selected variant. */}
              <ProductBuyPanel product={buyProduct} navHidden />

              {cfg.sections.trust && (
                <TrustBadges
                  requiresShipping={!!prod.requires_shipping}
                  freeShippingOver={profile.free_shipping_over != null ? Number(profile.free_shipping_over) : null}
                />
              )}

              {prod.description && (
                <div className="sf-border border-t pt-5">
                  <h2 className="sf-display mb-2 text-base font-semibold">Description</h2>
                  <p className="sf-muted whitespace-pre-line text-sm leading-relaxed">{prod.description}</p>
                </div>
              )}
              <p className="sf-muted text-xs">Sold by {sellerName}</p>
            </div>
          </div>

          {cfg.sections.related && relatedItems.length > 0 && (
            <section className="mt-14">
              <h2 className="sf-display mb-4 text-xl font-bold tracking-tight">You may also like</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {relatedItems.map((r) => (
                  <ProductCard key={r.id} p={r} base="/store" cardStyle={cfg.card} showRatings={cfg.sections.ratings} showBadges={cfg.sections.badges} />
                ))}
              </div>
            </section>
          )}

          <div id="reviews" className="mt-14">
            <ReviewsSection subjectType="product" subjectId={prod.id} summary={summary} reviews={reviews} subjectLabel="product" />
          </div>

          {cfg.sections.testimonials && <TestimonialsSection items={testimonialItems} align={cfg.sectionAlign} />}
          {cfg.sections.brands && <BrandLogoSlider logos={chrome.brandLogos} />}
          {cfg.sections.faq && <FaqSection items={chrome.faqs} align={cfg.sectionAlign} />}
        </main>
      </StorefrontShell>
      <CartDrawer />
    </CartProvider>
  );
}
