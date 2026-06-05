import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Store } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import { ShippingRatesForm } from "@/components/dashboard/store/ShippingRatesForm";
import {
  ProductInventoryManager,
  type StoreProduct,
} from "@/components/dashboard/store/ProductInventoryManager";
import {
  CatalogManager,
  type CatalogProduct,
} from "@/components/dashboard/store/CatalogManager";
import {
  CollectionsManager,
  type CollectionRow,
  type ProductOption,
} from "@/components/dashboard/store/CollectionsManager";

export const metadata = { title: "Store" };

const SPARK = [4, 6, 5, 7, 6, 8, 7, 9];

export default async function StoreDashboardPage() {
  const ctx = await requirePageActor("store.view", "/dashboard/store");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subdomain, shipping_flat_fee, free_shipping_over")
    .eq("id", ctx.ownerId)
    .single();

  // Active products + which sit on a published page (what the store shows).
  const { data: productsRaw } = await admin
    .from("products")
    .select(
      "id, name, requires_shipping, stock, sku, page_id, pages!products_page_id_fkey(status, title, type)",
    )
    .eq("user_id", ctx.ownerId)
    .eq("active", true);
  const totalActive = (productsRaw ?? []).length;
  type ProdRow = {
    id: string;
    name: string;
    requires_shipping: boolean | null;
    stock: number | null;
    sku: string | null;
    page_id: string | null;
    pages?:
      | { status?: string; title?: string; type?: string }
      | { status?: string; title?: string; type?: string }[]
      | null;
  };
  const prodRows = (productsRaw ?? []) as ProdRow[];
  const pageOf = (r: ProdRow) => (Array.isArray(r.pages) ? r.pages[0] : r.pages);
  const liveCount = prodRows.filter(
    (r) => pageOf(r)?.status === "published",
  ).length;
  const storeProducts: StoreProduct[] = prodRows
    .filter((r) => !!r.page_id)
    .map((r) => ({
      page_id: r.page_id as string,
      name: r.name,
      page_title: pageOf(r)?.title ?? null,
      requires_shipping: !!r.requires_shipping,
      stock: r.stock ?? null,
      sku: r.sku ?? null,
    }));

  // Catalog products (managed from this dashboard) — include hidden ones.
  const { data: catalogRaw } = await admin
    .from("products")
    .select(
      "id, name, price, description, image_url, category, requires_shipping, stock, sku, active, pages!products_page_id_fkey(slug)",
    )
    .eq("user_id", ctx.ownerId)
    .eq("is_catalog", true)
    .order("created_at", { ascending: false });
  const catalogProducts: CatalogProduct[] = ((catalogRaw ?? []) as Array<{
    id: string;
    name: string;
    price: number;
    description: string | null;
    image_url: string | null;
    category: string | null;
    requires_shipping: boolean | null;
    stock: number | null;
    sku: string | null;
    active: boolean;
    pages?: { slug: string } | { slug: string }[] | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    price: Number(r.price ?? 0),
    description: r.description,
    image_url: r.image_url,
    category: r.category,
    requires_shipping: !!r.requires_shipping,
    stock: r.stock,
    sku: r.sku,
    active: r.active,
    slug: (Array.isArray(r.pages) ? r.pages[0] : r.pages)?.slug ?? null,
  }));

  // Collections + their membership, and the product picker options.
  const [{ data: colsRaw }, { data: memRaw }] = await Promise.all([
    admin
      .from("collections")
      .select("id, name, slug, description, image_url")
      .eq("user_id", ctx.ownerId)
      .order("sort_order", { ascending: true }),
    admin
      .from("collection_products")
      .select("collection_id, product_id, collections!inner(user_id)")
      .eq("collections.user_id", ctx.ownerId),
  ]);
  const membersByCol = new Map<string, string[]>();
  for (const m of (memRaw ?? []) as Array<{ collection_id: string; product_id: string }>) {
    const arr = membersByCol.get(m.collection_id) ?? [];
    arr.push(m.product_id);
    membersByCol.set(m.collection_id, arr);
  }
  const collections: CollectionRow[] = ((colsRaw ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
  }>).map((c) => ({ ...c, productIds: membersByCol.get(c.id) ?? [] }));
  const productOptions: ProductOption[] = prodRows
    .filter((r) => !!r.name)
    .map((r) => ({ id: r.id, name: r.name }));

  const subdomain = profile?.subdomain ?? null;
  const storeUrl = subdomain
    ? `https://${subdomain}.${platformRootDomain()}`
    : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Store"
        blurb="Your subdomain is a public storefront — every active product on a published page shows up automatically."
        gradient="from-emerald-600 via-teal-600 to-green-600"
        resourcesHref={null}
      />

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard
          label="Live products"
          value={liveCount.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#10b981"
        />
        <PageStatCard
          label="Active products"
          value={totalActive.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#6366f1"
        />
        <PageStatCard
          label="Storefront"
          value={subdomain ? "Open" : "Setup"}
          trendPct={null}
          spark={SPARK}
          color="#8b5cf6"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        {storeUrl ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4 text-muted-foreground" /> Your store
              </CardTitle>
              <CardDescription>
                {liveCount} live product{liveCount === 1 ? "" : "s"} · grouped by
                category, each opens its own checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <code className="block break-all rounded bg-muted px-3 py-2 text-sm">
                {storeUrl}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> View store
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/store/orders">Manage orders</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Claim a subdomain first</CardTitle>
              <CardDescription>
                Your store lives at your subdomain. Pick one to open your
                storefront.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/settings/domains">Choose a subdomain →</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Catalog products */}
      <div className="animate-in-up" style={{ animationDelay: "130ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Products</CardTitle>
            <CardDescription>
              Add standalone products — each gets its own checkout page and shows
              on your storefront automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CatalogManager products={catalogProducts} storeUrl={storeUrl} />
          </CardContent>
        </Card>
      </div>

      {/* Collections */}
      <div className="animate-in-up" style={{ animationDelay: "140ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collections</CardTitle>
            <CardDescription>
              Group products into collections to merchandise your storefront —
              each gets a shareable <code>/c/&lt;slug&gt;</code> page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionsManager
              collections={collections}
              allProducts={productOptions}
              storeUrl={storeUrl}
            />
          </CardContent>
        </Card>
      </div>

      {/* Shipping rates (seller-level) */}
      <div className="animate-in-up" style={{ animationDelay: "150ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipping rates</CardTitle>
            <CardDescription>
              A flat fee added to physical orders, optionally waived above a
              subtotal threshold.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShippingRatesForm
              flatFee={Number(profile?.shipping_flat_fee ?? 0)}
              freeOver={
                profile?.free_shipping_over != null
                  ? Number(profile.free_shipping_over)
                  : null
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Per-product shipping + inventory */}
      <div className="animate-in-up" style={{ animationDelay: "180ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Products — shipping &amp; inventory</CardTitle>
            <CardDescription>
              Mark a product physical to collect a delivery address, and track
              stock to auto-hide it when sold out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductInventoryManager products={storeProducts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
