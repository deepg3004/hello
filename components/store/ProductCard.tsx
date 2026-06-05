import Link from "next/link";

import { formatINR } from "@/lib/utils";
import { Stars } from "@/components/store/Stars";
import {
  AddToCartButton,
  type VariantOption,
} from "@/components/store/cart/AddToCartButton";

export interface CatalogItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  is_popular: boolean;
  category: string | null;
  stock: number | null;
  variants: VariantOption[];
  rating: { average: number; count: number };
}

/** Shopify-style product card for the /store catalog grid. */
export function ProductCard({ p, base }: { p: CatalogItem; base: string }) {
  const href = `${base}/${p.slug}`;
  const off =
    p.original_price && p.original_price > p.price
      ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
      : 0;
  const lowStock = p.stock != null && p.stock > 0 && p.stock <= 5;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:border-primary hover:shadow-md">
      <Link href={href} className="relative block aspect-square w-full overflow-hidden bg-zinc-100">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image_url}
            alt={p.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-indigo-100 to-violet-100" />
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {off > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              {off}% OFF
            </span>
          )}
          {p.is_popular && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-900 shadow">
              Popular
            </span>
          )}
        </div>
        {p.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-zinc-700">
            Sold out
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        {p.category && (
          <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {p.category}
          </span>
        )}
        <Link href={href} className="line-clamp-2 font-medium leading-snug hover:text-primary">
          {p.name}
        </Link>

        {p.rating.count > 0 ? (
          <div className="mt-1 flex items-center gap-1.5">
            <Stars value={p.rating.average} size={13} />
            <span className="text-xs text-muted-foreground">({p.rating.count})</span>
          </div>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">No reviews yet</div>
        )}

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold">{formatINR(Math.round(p.price * 100))}</span>
          {p.original_price && p.original_price > p.price && (
            <span className="text-sm text-muted-foreground line-through">
              {formatINR(Math.round(p.original_price * 100))}
            </span>
          )}
        </div>
        {lowStock && (
          <p className="mt-1 text-xs font-medium text-rose-600">Only {p.stock} left</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {p.stock === 0 ? (
            <button
              disabled
              className="flex-1 rounded-full bg-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500"
            >
              Sold out
            </button>
          ) : (
            <AddToCartButton
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
              product={{
                product_id: p.id,
                name: p.name,
                price: p.price,
                image_url: p.image_url,
                slug: p.slug,
              }}
              variants={p.variants}
            />
          )}
          <Link
            href={href}
            className="rounded-full border px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-primary hover:text-primary"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
