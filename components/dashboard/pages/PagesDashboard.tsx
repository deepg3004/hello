"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { CreatePageTile, PageCard } from "@/components/dashboard/PageCard";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import { PagesTable } from "@/components/dashboard/pages/PagesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAGE_CATEGORIES,
  PAGE_CATEGORY_NAV,
  createPageHref,
  type PageCategoryKey,
} from "@/lib/dashboard/page-categories";
import type {
  CategoryStats,
  DashboardPageRow,
} from "@/lib/dashboard/page-category-queries";
import { cn, formatINR } from "@/lib/utils";

type StatusFilter = "all" | "published" | "unpublished" | "draft";
type SortKey = "newest" | "revenue" | "sales" | "name";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "published", label: "Published" },
  { key: "unpublished", label: "Unpublished" },
  { key: "draft", label: "Draft" },
  { key: "all", label: "All" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "revenue", label: "Highest revenue" },
  { key: "sales", label: "Most sales" },
  { key: "name", label: "Name A–Z" },
];

function statusBucket(status: string): StatusFilter {
  if (status === "published") return "published";
  if (status === "draft") return "draft";
  return "unpublished"; // paused / archived
}

interface PagesDashboardProps {
  categoryKey: PageCategoryKey;
  pages: DashboardPageRow[];
  stats: CategoryStats;
  atLimit: boolean;
  planName: string;
  limit: number;
}

export function PagesDashboard({
  categoryKey,
  pages,
  stats,
  atLimit,
  planName,
  limit,
}: PagesDashboardProps) {
  const cfg = PAGE_CATEGORIES[categoryKey];

  const [status, setStatus] = useState<StatusFilter>("published");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "table">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Status counts for the filter tabs.
  const counts = useMemo(() => {
    const c = { all: pages.length, published: 0, unpublished: 0, draft: 0 };
    for (const p of pages) c[statusBucket(p.status)] += 1;
    return c;
  }, [pages]);

  // status → search → sort pipeline.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = pages.filter(
      (p) => status === "all" || statusBucket(p.status) === status,
    );
    if (q) {
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      );
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "revenue":
          return b.total_revenue - a.total_revenue;
        case "sales":
          return b.conversion_count - a.conversion_count;
        case "name":
          return a.title.localeCompare(b.title);
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return sorted;
  }, [pages, status, query, sort]);

  // Pagination (clamped — filters can shrink the list under the current page).
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function exportCsv() {
    const head = [
      "Title",
      "Slug",
      "Type",
      "Status",
      "Price",
      "Sales",
      "Revenue",
      "Views",
      "Created",
    ];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = filtered.map((p) =>
      [
        p.title,
        p.slug,
        p.type,
        p.status,
        p.priceLabel,
        String(p.conversion_count),
        String(p.total_revenue),
        String(p.view_count),
        new Date(p.created_at).toISOString().slice(0, 10),
      ]
        .map((v) => escape(String(v)))
        .join(","),
    );
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cfg.key}-pages.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ctaLabel =
    categoryKey === "all" ? "Create Page" : `Create ${cfg.label.replace(/ Pages?$/, " Page")}`;

  return (
    <div className="space-y-6">
      {/* ── Hero banner — colourful per category (cfg.heroGradient) ───── */}
      <DashboardHero title={cfg.label} blurb={cfg.blurb} gradient={cfg.heroGradient}>
        {atLimit ? (
          <Button asChild className="bg-card text-foreground hover:bg-white/90">
            <Link href="/dashboard/upgrade?required=pro">
              <Sparkles className="mr-2 h-4 w-4" /> Upgrade to add more
            </Link>
          </Button>
        ) : (
          <Button asChild className="bg-card text-foreground hover:bg-white/90">
            <Link href={createPageHref(cfg)}>
              <Plus className="mr-2 h-4 w-4" /> {ctaLabel}
            </Link>
          </Button>
        )}
      </DashboardHero>

      {/* ── Category nav ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {PAGE_CATEGORY_NAV.map((c) => {
          const active = c.key === categoryKey;
          return (
            <Link
              key={c.key}
              href={c.route}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                active
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label.replace(/ Pages?$/, "")}
            </Link>
          );
        })}
      </div>

      {/* ── Stats row ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        <PageStatCard
          label="Total Sales"
          value={stats.totalSales.toLocaleString("en-IN")}
          trendPct={stats.salesTrendPct}
          spark={stats.spark.map((s) => s.sales)}
          color="#6366f1"
        />
        <PageStatCard
          label="Total Revenue"
          value={formatINR(stats.totalRevenue * 100)}
          trendPct={stats.revenueTrendPct}
          spark={stats.spark.map((s) => s.revenue)}
          color="#10b981"
        />
        <PageStatCard
          label="Conversion"
          value={`${stats.conversionPct}%`}
          trendPct={null}
          spark={stats.spark.map((s) => s.sales)}
          color="#f59e0b"
        />
      </div>

      {/* ── Status filter tabs ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => {
          const active = status === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => resetPage(setStatus)(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-background/20" : "bg-foreground/10",
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search pages…"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="mr-1.5 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setView("table")}
            aria-label="Table view"
            className={cn(
              "flex h-9 w-9 items-center justify-center transition",
              view === "table"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <TableIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={cn(
              "flex h-9 w-9 items-center justify-center border-l border-border transition",
              view === "grid"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {query
              ? "No pages match your search."
              : `No ${status === "all" ? "" : status + " "}pages here yet.`}
          </p>
          {!atLimit && !query && (
            <Button asChild className="mt-4">
              <Link href={createPageHref(cfg)}>
                <Plus className="mr-2 h-4 w-4" /> {ctaLabel}
              </Link>
            </Button>
          )}
        </div>
      ) : view === "table" ? (
        <PagesTable rows={visible} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <PageCard key={p.id} page={p} />
          ))}
          {safePage === pageCount && (
            <CreatePageTile
              disabled={atLimit}
              type={cfg.createType}
              href={createPageHref(cfg)}
            />
          )}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {start + 1}–{Math.min(start + pageSize, filtered.length)} of{" "}
            {filtered.length} · {planName}
            {limit !== -1 && ` · limit ${limit}`}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-muted-foreground">
              Per page
              <Input
                type="number"
                min={1}
                value={pageSize}
                onChange={(e) =>
                  resetPage(setPageSize)(Math.max(1, Number(e.target.value) || 12))
                }
                className="h-8 w-16"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Previous
            </Button>
            <span className="tabular-nums text-muted-foreground">
              Page {safePage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
