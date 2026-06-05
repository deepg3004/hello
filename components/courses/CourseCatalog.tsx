"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { CourseCard, type CourseCardItem } from "@/components/courses/CourseCard";

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
}: {
  items: CourseCardItem[];
  categories: string[];
  levels: string[];
  base: string;
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="pl-9" />
        </div>
        {levels.length > 0 && (
          <select
            value={level ?? ""}
            onChange={(e) => setLevel(e.target.value || null)}
            className="h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="">All levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
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

      <p className="mb-4 text-sm text-muted-foreground">
        {filtered.length} course{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No courses match your search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CourseCard key={c.id} c={c} base={base} />
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
