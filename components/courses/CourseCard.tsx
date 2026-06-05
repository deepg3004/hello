import Link from "next/link";
import { Users } from "lucide-react";

import { formatINR } from "@/lib/utils";
import { Stars } from "@/components/store/Stars";
import { cardClassName } from "@/components/store/ProductCard";
import type { CardStyle } from "@/lib/storefront-theme";

export interface CourseCardItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  instructor: string | null;
  level: string | null;
  category: string | null;
  price: number | null;
  original_price: number | null;
  lessons: number;
  students: number;
  rating: { average: number; count: number };
}

/** Udemy-style, theme-aware course card for the catalog + "related" rails. */
export function CourseCard({
  c,
  base,
  cardStyle = "elevated",
  showRatings = true,
}: {
  c: CourseCardItem;
  base: string;
  cardStyle?: CardStyle;
  showRatings?: boolean;
}) {
  const href = `${base}/${c.slug}`;
  return (
    <Link href={href} className={`group flex flex-col overflow-hidden transition hover:-translate-y-0.5 ${cardClassName(cardStyle)}`}>
      <div className="relative aspect-video w-full overflow-hidden">
        {c.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--sf-bg2)] to-[var(--sf-surface)]" />
        )}
        {c.level && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {c.level}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="sf-display line-clamp-2 font-semibold leading-snug transition group-hover:opacity-80">{c.title}</h3>
        {c.subtitle && <p className="sf-muted mt-0.5 line-clamp-2 text-xs">{c.subtitle}</p>}
        {c.instructor && <p className="sf-muted mt-1 text-xs">{c.instructor}</p>}

        {showRatings && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            {c.rating.count > 0 ? (
              <>
                <span className="font-semibold text-amber-500">{c.rating.average.toFixed(1)}</span>
                <Stars value={c.rating.average} size={12} />
                <span className="sf-muted">({c.rating.count})</span>
              </>
            ) : (
              <span className="sf-muted">New course</span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            {c.price != null ? (
              <span className="text-base font-bold">{formatINR(Math.round(c.price * 100))}</span>
            ) : (
              <span className="text-sm font-semibold">Free</span>
            )}
            {c.original_price != null && c.price != null && c.original_price > c.price && (
              <span className="sf-muted text-xs line-through">{formatINR(Math.round(c.original_price * 100))}</span>
            )}
          </div>
          <span className="sf-muted inline-flex items-center gap-1 text-[11px]">
            <Users className="h-3 w-3" /> {c.students}
          </span>
        </div>
      </div>
    </Link>
  );
}
