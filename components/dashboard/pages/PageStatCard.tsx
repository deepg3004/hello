"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

// Fallback accent when a caller doesn't pass an explicit colour.
const SPARK_COLOR = "#7C3AED";

interface PageStatCardProps {
  label: string;
  value: string;
  /** Last-7d-vs-prior % change. null hides the trend chip. */
  trendPct: number | null;
  /** 14-point sparkline series for this metric. */
  spark: number[];
  /** Per-card accent (hex) — tints the sparkline and the top accent strip. */
  color?: string;
}

export function PageStatCard({
  label,
  value,
  trendPct,
  spark,
  color = SPARK_COLOR,
}: PageStatCardProps) {
  const up = (trendPct ?? 0) >= 0;
  const data = spark.map((v, i) => ({ i, v }));
  const gradientId = `spark-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="group relative min-w-[240px] flex-1 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md">
      {/* Colored top accent strip — the splash of per-metric colour. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${color}, ${color}00)`,
        }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="font-sora text-[1.7rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
            {value}
          </div>
          {trendPct !== null && (
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                up
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
              )}
            >
              {up ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trendPct)}% <span className="font-normal opacity-70">vs last week</span>
            </span>
          )}
        </div>
        {/* Sparkline */}
        <div className="w-28 shrink-0">
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
