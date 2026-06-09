// Public collection page — sub.invoxai.io/c/<slug>. Lists the products a seller
// grouped into one collection, each card linking to its checkout page. Resolves
// the seller from the subdomain (same as the storefront).

import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSurfaceConfig, resolveChromeConfig } from "@/lib/storefront-theme";
import {
  StoreGrid,
  type StoreProduct,
  type StoreSection,
} from "@/components/store/StoreGrid";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { StorefrontShell } from "@/components/store/StorefrontShell";

export const dynamic = "force-dynamic";

interface Props {
  params: { username: string; slug: string };
}

export async function generateMetadata({ params }: Props) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) return { title: params.slug };
  const { data: col } = await admin
    .from("collections")
    .select("name, description")
    .eq("user_id", profile.id)
    .eq("slug", params.slug)
    .maybeSingle();
  return {
    title: col?.name ?? params.slug,
    description: col?.description ?? undefined,
  };
}

interface PageJoin {
  slug: string;
  status: string;
}
interface ProductJoin {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  is_popular: boolean;
  is_catalog: boolean;
  active: boolean;
  pages?: PageJoin | PageJoin[] | null;
  product_variants?: Array<{ id: string; name: string; price: number; active: boolean; sort_order: number }> | null;
}

export default async function CollectionPage({ params }: Props) {
  noStore();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "store");
  const chrome = resolveChromeConfig(profile.storefront_config);

  const { data: collection } = await admin
    .from("collections")
    .select("id, name, description, active")
    .eq("user_id", profile.id)
    .eq("slug", params.slug)
    .maybeSingle();
  if (!collection || collection.active === false) notFound();

  const { data: memRaw } = await admin
    .from("collection_products")
    .select(
      "sort_order, products!inner(id, name, description, image_url, price, original_price, is_popular, is_catalog, active, pages!products_page_id_fkey(slug, status), product_variants(id, name, price, active, sort_order))",
    )
    .eq("collection_id", collection.id)
    .order("sort_order", { ascending: true });

  const products: StoreProduct[] = ((memRaw ?? []) as Array<{ products: ProductJoin | ProductJoin[] | null }>)
    .map((m) => (Array.isArray(m.products) ? m.products[0] : m.products))
    .filter((p): p is ProductJoin => !!p && p.active)
    .map((p): StoreProduct | null => {
      const page = Array.isArray(p.pages) ? p.pages[0] : p.pages;
      return page && page.status === "published"
        ? {
            id: p.id,
            name: p.name ?? "Untitled",
            description: p.description,
            image_url: p.image_url,
            price: Number(p.price ?? 0),
            original_price: p.original_price != null ? Number(p.original_price) : null,
            is_popular: !!p.is_popular,
            is_catalog: !!p.is_catalog,
            slug: page.slug,
            variants: (p.product_variants ?? [])
              .filter((v) => v.active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((v) => ({ id: v.id, name: v.name, price: Number(v.price ?? 0) })),
          }
        : null;
    })
    .filter((p): p is StoreProduct => !!p);

  const sellerName =
    profile.legal_business_name ?? profile.full_name ?? params.username;
  const sections: StoreSection[] = products.length
    ? [{ key: "collection", label: collection.name, products }]
    : [];

  return (
    <CartProvider username={params.username} sellerId={profile.id}>
    <StorefrontShell cfg={cfg} chrome={chrome} brandName={sellerName} sellerId={profile.id} username={params.username}>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="sf-muted text-sm hover:underline">
            ← {sellerName}
          </Link>
          <h1 className="sf-display mt-2 text-3xl font-bold tracking-tight">{collection.name}</h1>
          {collection.description && <p className="sf-muted mt-1 max-w-2xl text-sm">{collection.description}</p>}
        </div>

        {products.length === 0 ? (
          <p className="sf-muted">No products in this collection yet.</p>
        ) : (
          <StoreGrid sections={sections} cardStyle={cfg.card} showBadges={cfg.sections.badges} cols={cfg.cols} />
        )}
      </main>
    </StorefrontShell>
    <CartDrawer />
    </CartProvider>
  );
}
