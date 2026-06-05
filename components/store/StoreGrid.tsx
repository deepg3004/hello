import Link from "next/link";

import { formatINR } from "@/lib/utils";
import {
  AddToCartButton,
  type VariantOption,
} from "@/components/store/cart/AddToCartButton";
import { cardClassName } from "@/components/store/ProductCard";
import { gridColsClass, type CardStyle } from "@/lib/storefront-theme";

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
  variants?: VariantOption[];
}

export interface StoreSection {
  key: string;
  label: string;
  products: StoreProduct[];
}

/** Public product catalog grid, grouped into category sections. Theme-aware. */
export function StoreGrid({
  sections,
  cardStyle = "elevated",
  showBadges = true,
  cols = { desktop: 4, tablet: 3, mobile: 2 },
}: {
  sections: StoreSection[];
  cardStyle?: CardStyle;
  showBadges?: boolean;
  cols?: { desktop: number; tablet: number; mobile: number };
}) {
  return (
    <div className="space-y-10">
      {sections.map((s) => (
        <section key={s.key}>
          <h2 className="sf-display mb-4 text-lg font-bold tracking-tight">{s.label}</h2>
          <div className={`grid gap-4 ${gridColsClass(cols)}`}>
            {s.products.map((p) => (
              <Link key={p.id} href={`/${p.slug}`} className={`group block overflow-hidden transition hover:-translate-y-0.5 ${cardClassName(cardStyle)}`}>
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[var(--sf-bg2)] to-[var(--sf-surface)]" />
                  )}
                  {showBadges && p.is_popular && (
                    <span className="sf-accent-bg absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow">
                      Popular
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="sf-display font-semibold tracking-tight transition group-hover:opacity-80">{p.name}</h3>
                  {p.description && <p className="sf-muted mt-1 line-clamp-2 text-sm">{p.description}</p>}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold">{formatINR(Math.round(p.price * 100))}</span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="sf-muted text-sm line-through">{formatINR(Math.round(p.original_price * 100))}</span>
                      )}
                    </div>
                    {p.is_catalog && (
                      <AddToCartButton
                        className="sf-btn inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        product={{ product_id: p.id, name: p.name, price: p.price, image_url: p.image_url, slug: p.slug }}
                        variants={p.variants}
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
