import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant placeholder shown the moment a dashboard/admin link is clicked, while
 * the server component fetches its data. Without a loading boundary the browser
 * would sit on the previous page until the queries resolve — this is what makes
 * navigation feel instant. Mirrors the hero + stat-cards + table layout used
 * across the section dashboards.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <Skeleton className="h-32 w-full rounded-2xl sm:h-36" />

      {/* Stat cards */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 min-w-[240px] flex-1 rounded-xl" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Table / list rows */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 flex-1 rounded" />
            <Skeleton className="hidden h-4 w-20 rounded sm:block" />
            <Skeleton className="hidden h-4 w-20 rounded sm:block" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
