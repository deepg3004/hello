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

// Centralised palette so a new accent only needs one row added here and
// everything (circle bg, icon colour) picks it up consistently.
const ACCENT_CLASSES: Record<
  MetricAccent,
  { circle: string; icon: string }
> = {
  indigo: {
    circle: "bg-indigo-50",
    icon: "text-indigo-600",
  },
  emerald: {
    circle: "bg-emerald-50",
    icon: "text-emerald-600",
  },
  amber: {
    circle: "bg-amber-50",
    icon: "text-amber-600",
  },
  rose: {
    circle: "bg-rose-50",
    icon: "text-rose-600",
  },
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
  const accent = ACCENT_CLASSES[accentColor];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        "transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      {/* Top row: 36px tinted circle (when icon supplied) + uppercase label */}
      <div className="flex items-center gap-3">
        {Icon && (
          <span
            aria-hidden
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              accent.circle,
            )}
          >
            <Icon className={cn("h-4 w-4", accent.icon)} strokeWidth={2.25} />
          </span>
        )}
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>

      {/* Middle: value */}
      <div className="mt-3 font-sora text-2xl font-bold tracking-tight text-foreground">
        {value}
      </div>

      {/* Bottom: hint + optional trend chip */}
      {(hint || trend) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                trend.direction === "up"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700",
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
