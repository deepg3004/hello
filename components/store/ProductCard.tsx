import Link from "next/link";

import { formatINR } from "@/lib/utils";
import { Stars } from "@/components/store/Stars";
import {
  AddToCartButton,
  type VariantOption,
} from "@/components/store/cart/AddToCartButton";
import type { CardStyle } from "@/lib/storefront-theme";

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

export function cardClassName(style: CardStyle): string {
  switch (style) {
    case "glass":
      return "sf-card-glass";
    case "bordered":
      return "sf-card";
    case "flat":
      return "sf-card border-transparent";
    case "elevated":
    default:
      return "sf-card shadow-[0_8px_30px_rgba(0,0,0,0.12)]";
  }
}

/** Premium, theme-aware product card for the /store catalog grid. */
export function ProductCard({
  p,
  base,
  cardStyle = "elevated",
  showBadges = true,
  showRatings = true,
}: {
  p: CatalogItem;
  base: string;
  cardStyle?: CardStyle;
  showBadges?: boolean;
  showRatings?: boolean;
}) {
  const href = `${base}/${p.slug}`;
  const off =
    p.original_price && p.original_price > p.price
      ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
      : 0;
  const lowStock = p.stock != null && p.stock > 0 && p.stock <= 5;

  return (
    <div className={`group flex flex-col overflow-hidden transition hover:-translate-y-0.5 ${cardClassName(cardStyle)}`}>
      <Link href={href} className="relative block aspect-square w-full overflow-hidden">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--sf-bg2)] to-[var(--sf-surface)]" />
        )}
        {showBadges && (
          <div className="absolute left-2.5 top-2.5 flex flex-col gap-1">
            {off > 0 && (
              <span className="sf-accent-bg rounded-full px-2 py-0.5 text-[10px] font-bold shadow">{off}% OFF</span>
            )}
            {p.is_popular && (
              <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow backdrop-blur">
                Popular
              </span>
            )}
          </div>
        )}
        {p.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
            Sold out
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        {p.category && (
          <span className="sf-accent mb-1 text-[11px] font-semibold uppercase tracking-wider">{p.category}</span>
        )}
        <Link href={href} className="sf-display line-clamp-2 font-semibold leading-snug transition hover:opacity-80">
          {p.name}
        </Link>

        {showRatings &&
          (p.rating.count > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Stars value={p.rating.average} size={13} />
              <span className="sf-muted text-xs">({p.rating.count})</span>
            </div>
          ) : (
            <div className="sf-muted mt-1 text-xs">No reviews yet</div>
          ))}

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold">{formatINR(Math.round(p.price * 100))}</span>
          {p.original_price && p.original_price > p.price && (
            <span className="sf-muted text-sm line-through">{formatINR(Math.round(p.original_price * 100))}</span>
          )}
        </div>
        {lowStock && <p className="mt-1 text-xs font-medium text-rose-500">Only {p.stock} left</p>}

        <div className="mt-3 flex items-center gap-2">
          {p.stock === 0 ? (
            <button disabled className="flex-1 rounded-full border border-[var(--sf-border)] px-3 py-2 text-xs font-semibold opacity-50">
              Sold out
            </button>
          ) : (
            <AddToCartButton
              className="sf-btn inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
              product={{ product_id: p.id, name: p.name, price: p.price, image_url: p.image_url, slug: p.slug }}
              variants={p.variants}
            />
          )}
          <Link href={href} className="sf-btn-outline px-3 py-2 text-xs font-semibold transition hover:opacity-80">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
