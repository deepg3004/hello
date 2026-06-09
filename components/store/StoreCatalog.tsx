"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { ProductCard, type CatalogItem } from "@/components/store/ProductCard";
import { gridColsClass, type CardStyle } from "@/lib/storefront-theme";

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";

/** Render this many cards at a time; "Load more" reveals the next batch so big
 *  catalogs don't paint hundreds of nodes (or scroll forever) at once. */
const PAGE_SIZE = 24;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
];

/** Premium, theme-aware catalog: search, category filter, price range, sort. */
export function StoreCatalog({
  items,
  categories,
  base,
  cardStyle = "elevated",
  showRatings = true,
  showBadges = true,
  cols = { desktop: 4, tablet: 3, mobile: 2 },
}: {
  items: CatalogItem[];
  categories: string[];
  base: string;
  cardStyle?: CardStyle;
  showRatings?: boolean;
  showBadges?: boolean;
  cols?: { desktop: number; tablet: number; mobile: number };
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("popular");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Any change to the query/filters resets the visible window to the first page.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, cat, sort, maxPrice]);

  const priceCeiling = useMemo(() => Math.max(100, ...items.map((i) => Math.ceil(i.price))), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = items.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (maxPrice != null && p.price > maxPrice) return false;
      if (term) {
        const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "rating":
          return b.rating.average - a.rating.average || b.rating.count - a.rating.count;
        case "newest":
          return 0;
        case "popular":
        default:
          return Number(b.is_popular) - Number(a.is_popular) || b.rating.count - a.rating.count;
      }
    });
    return out;
  }, [items, q, cat, sort, maxPrice]);

  const hasFilters = !!cat || maxPrice != null || !!q;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="sf-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="sf-input h-10 w-full pl-9 pr-3 text-sm outline-none"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sf-input h-10 px-3 text-sm outline-none">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key} className="text-black">
              {s.label}
            </option>
          ))}
        </select>
        <button onClick={() => setShowFilters((v) => !v)} className="sf-btn-outline inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={!cat} onClick={() => setCat(null)}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="sf-card mb-5 p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Max price: {maxPrice != null ? `₹${maxPrice}` : "Any"}</label>
            {maxPrice != null && (
              <button onClick={() => setMaxPrice(null)} className="sf-muted text-xs underline">
                clear
              </button>
            )}
          </div>
          <input
            type="range"
            min={0}
            max={priceCeiling}
            step={Math.max(1, Math.round(priceCeiling / 100))}
            value={maxPrice ?? priceCeiling}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="mt-2 w-full"
            style={{ accentColor: "var(--sf-accent)" }}
          />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="sf-muted text-sm">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </p>
        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              setCat(null);
              setMaxPrice(null);
            }}
            className="sf-muted inline-flex items-center gap-1 text-xs font-medium hover:opacity-80"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="sf-muted py-16 text-center">No products match your search.</p>
      ) : (
        <>
          <div className={`grid gap-4 ${gridColsClass(cols)}`}>
            {filtered.slice(0, visible).map((p) => (
              <ProductCard key={p.id} p={p} base={base} cardStyle={cardStyle} showRatings={showRatings} showBadges={showBadges} />
            ))}
          </div>
          {filtered.length > visible && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="sf-btn-outline px-6 py-3 text-sm font-semibold"
              >
                Load more ({filtered.length - visible} more)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={(active ? "sf-chip-active" : "sf-chip") + " px-3.5 py-1.5 text-sm font-medium transition hover:opacity-90"}>
      {children}
    </button>
  );
}
