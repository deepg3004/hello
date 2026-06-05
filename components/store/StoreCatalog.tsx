"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ProductCard, type CatalogItem } from "@/components/store/ProductCard";

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
];

/** Shopify-style catalog: client-side search, category filter, price range, sort. */
export function StoreCatalog({
  items,
  categories,
  base,
}: {
  items: CatalogItem[];
  categories: string[];
  base: string;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("popular");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const priceCeiling = useMemo(
    () => Math.max(100, ...items.map((i) => Math.ceil(i.price))),
    [items],
  );

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
          return 0; // already newest-first from the server
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
      {/* Search + sort bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-md border bg-white px-3 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      {/* Category chips */}
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

      {/* Price range (collapsible) */}
      {showFilters && (
        <div className="mb-5 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Max price: {maxPrice != null ? `₹${maxPrice}` : "Any"}
            </label>
            {maxPrice != null && (
              <button onClick={() => setMaxPrice(null)} className="text-xs text-muted-foreground underline">
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
            className="mt-2 w-full accent-primary"
          />
        </div>
      )}

      {/* Active filter summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </p>
        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              setCat(null);
              setMaxPrice(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No products match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} base={base} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-sm font-medium transition " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-white text-zinc-700 hover:border-primary hover:text-primary")
      }
    >
      {children}
    </button>
  );
}
