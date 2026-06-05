import Link from "next/link";

import { formatINR } from "@/lib/utils";
import { AddToCartButton } from "@/components/store/cart/AddToCartButton";

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number; // rupees
  original_price: number | null;
  is_popular: boolean;
  slug: string;
  is_catalog?: boolean;
}

export interface StoreSection {
  key: string;
  label: string;
  products: StoreProduct[];
}

/** Public product catalog grid, grouped into category sections. Server-only
 *  (no interactivity) — each card links to its product's checkout page. */
export function StoreGrid({ sections }: { sections: StoreSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((s) => (
        <section key={s.key}>
          <h2 className="mb-4 font-sora text-lg font-semibold tracking-tight">
            {s.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.products.map((p) => (
              <Link
                key={p.id}
                href={`/${p.slug}`}
                className="group block overflow-hidden rounded-xl border bg-white shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="relative aspect-[16/9] w-full bg-zinc-100">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-100 to-violet-100" />
                  )}
                  {p.is_popular && (
                    <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-900 shadow">
                      Popular
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-sora font-semibold tracking-tight group-hover:text-primary">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-foreground">
                        {formatINR(Math.round(p.price * 100))}
                      </span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatINR(Math.round(p.original_price * 100))}
                        </span>
                      )}
                    </div>
                    {p.is_catalog && (
                      <AddToCartButton
                        product={{
                          product_id: p.id,
                          name: p.name,
                          price: p.price,
                          image_url: p.image_url,
                          slug: p.slug,
                        }}
                      />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
