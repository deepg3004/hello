import { notFound } from "next/navigation";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { createAdminClient } from "@/lib/supabase/admin";

interface PageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  type: "payment" | "landing" | "lead_magnet";
  status: string;
  meta_description: string | null;
  thumbnail_url: string | null;
  view_count: number;
}

interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
  active: boolean;
}

async function loadPage(slug: string) {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, status, meta_description, thumbnail_url, view_count",
    )
    .eq("slug", slug)
    .single<PageRow>();

  if (!page || page.status !== "published") return null;

  // Pick the primary product for this page. If there are multiple, use the
  // first active one; the page builder will eventually expose primary selection.
  const { data: products } = await admin
    .from("products")
    .select("id, user_id, name, description, image_url, price, currency, active")
    .eq("user_id", page.user_id)
    .eq("page_id", page.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  const product = (products?.[0] as ProductRow | undefined) ?? null;
  return { page, product };
}

export default async function PublicPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!params.slug) notFound();
  const result = await loadPage(params.slug);

  if (!result) {
    // Either the page doesn't exist yet, or it isn't published. Render a
    // friendly placeholder rather than a 404 so we don't break previews.
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          invoxai.io / p
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {params.slug}
        </h1>
        <p className="mt-4 text-muted-foreground">
          This page isn&apos;t live yet. Check back soon.
        </p>
      </main>
    );
  }

  const { page, product } = result;

  // Fire-and-forget view count bump (RLS bypassed via admin client).
  try {
    const admin = createAdminClient();
    await admin
      .from("pages")
      .update({ view_count: (page.view_count ?? 0) + 1 })
      .eq("id", page.id);
  } catch {
    /* non-fatal */
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        {page.meta_description && (
          <p className="mt-2 text-muted-foreground">{page.meta_description}</p>
        )}
      </header>

      {product ? (
        <CheckoutForm
          pageId={page.id}
          productId={product.id}
          productName={product.name}
          productDescription={product.description}
          productImage={product.image_url}
          price={Number(product.price)}
          currency={product.currency}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          The seller hasn&apos;t attached a product to this page yet.
        </p>
      )}
    </main>
  );
}
