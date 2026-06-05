"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { CourseCard, type CourseCardItem } from "@/components/courses/CourseCard";
import { gridColsClass, type CardStyle } from "@/lib/storefront-theme";

type SortKey = "popular" | "rating" | "price_asc" | "price_desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "rating", label: "Top rated" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

export function CourseCatalog({
  items,
  categories,
  levels,
  base,
  cardStyle = "elevated",
  showRatings = true,
  cols = { desktop: 3, tablet: 2, mobile: 1 },
}: {
  items: CourseCardItem[];
  categories: string[];
  levels: string[];
  base: string;
  cardStyle?: CardStyle;
  showRatings?: boolean;
  cols?: { desktop: number; tablet: number; mobile: number };
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("popular");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = items.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (level && c.level !== level) return false;
      if (term) {
        const hay = `${c.title} ${c.subtitle ?? ""} ${c.category ?? ""} ${c.instructor ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return (a.price ?? 0) - (b.price ?? 0);
        case "price_desc":
          return (b.price ?? 0) - (a.price ?? 0);
        case "rating":
          return b.rating.average - a.rating.average || b.rating.count - a.rating.count;
        case "popular":
        default:
          return b.students - a.students || b.rating.count - a.rating.count;
      }
    });
    return out;
  }, [items, q, cat, level, sort]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="sf-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses…"
            className="sf-input h-10 w-full pl-9 pr-3 text-sm outline-none"
          />
        </div>
        {levels.length > 0 && (
          <select value={level ?? ""} onChange={(e) => setLevel(e.target.value || null)} className="sf-input h-10 px-3 text-sm outline-none">
            <option value="" className="text-black">
              All levels
            </option>
            {levels.map((l) => (
              <option key={l} value={l} className="text-black">
                {l}
              </option>
            ))}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sf-input h-10 px-3 text-sm outline-none">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key} className="text-black">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {categories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
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

      <p className="sf-muted mb-4 text-sm">
        {filtered.length} course{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="sf-muted py-16 text-center">No courses match your search.</p>
      ) : (
        <div className={`grid gap-4 ${gridColsClass(cols)}`}>
          {filtered.map((c) => (
            <CourseCard key={c.id} c={c} base={base} cardStyle={cardStyle} showRatings={showRatings} />
          ))}
        </div>
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
