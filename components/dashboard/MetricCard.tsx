import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type MetricAccent = "indigo" | "emerald" | "amber" | "rose";

export interface MetricTrend {
  direction: "up" | "down";
  /** Human-readable trend tag — e.g. "+18% vs last month". */
  label: string;
}

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** A Lucide icon component, e.g. `TrendingUp`. Rendered inside the tinted
   *  circle in the top-left. Optional so the legacy `<MetricCard label value
   *  hint />` callers across admin pages keep working without the icon. */
  icon?: LucideIcon;
  trend?: MetricTrend;
  accentColor?: MetricAccent;
  className?: string;
}

// Premium-monochrome look: every metric icon uses the neutral tile (charcoal
// glyph on a soft neutral fill). The `accentColor` prop is kept for API
// compatibility but no longer paints the tile a different hue — the palette is
// intentionally monochrome, with meaning carried by the trend chip instead.
const ACCENT_TILE: Record<MetricAccent, string> = {
  indigo: "tile-neutral",
  emerald: "tile-neutral",
  amber: "tile-neutral",
  rose: "tile-neutral",
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  accentColor = "indigo",
  className,
}: MetricCardProps) {
  const tile = ACCENT_TILE[accentColor];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card-md",
        className,
      )}
    >
      {/* Top row: 40px gradient icon tile (when icon supplied) + label */}
      <div className="flex items-center gap-3">
        {Icon && (
          <span
            aria-hidden
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
              tile,
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>

      {/* Middle: value */}
      <div className="mt-3 font-sora text-[1.7rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </div>

      {/* Bottom: hint + optional trend chip */}
      {(hint || trend) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ring-1 ring-inset",
                trend.direction === "up"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20"
                  : "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
              )}
            >
              {trend.direction === "up" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {trend.label}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
