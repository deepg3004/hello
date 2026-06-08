"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export interface EarningsPoint {
  /** yyyy-MM */
  key: string;
  /** Short axis label, e.g. "Jan" or "Jan '26". */
  label: string;
  /** Earnings in rupees. */
  value: number;
}

const RANGES = [
  { key: "12", label: "Last 12 months" },
  { key: "6", label: "Last 6 months" },
  { key: "3", label: "Last 3 months" },
] as const;

/**
 * SuperProfile-style earnings card: a large total over the selected window with
 * a smooth area chart. Premium-monochrome palette — a single purple accent.
 */
export function EarningsCard({
  series,
  title = "Total earnings",
}: {
  series: EarningsPoint[];
  /** Card heading + tooltip label. Defaults to the seller "Total earnings". */
  title?: string;
}) {
  const [range, setRange] = useState<string>("12");

  const data = useMemo(
    () => series.slice(-Number(range)),
    [series, range],
  );
  const total = useMemo(() => data.reduce((a, p) => a + p.value, 0), [data]);

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="th-label flex items-center gap-1">
            {title}
            <Info className="h-3 w-3 opacity-60" />
          </p>
          <p className="mt-1.5 font-sora text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
            <AnimatedNumber
              value={total}
              format={(n) => formatINR(Math.round(n) * 100)}
            />
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 h-56 w-full">
        {data.some((d) => d.value > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="earnings-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: "#7C3AED", strokeOpacity: 0.3 }}
                formatter={(v) => [formatINR(Number(v ?? 0) * 100), "Earnings"]}
                labelFormatter={(l) => String(l)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#7C3AED"
                strokeWidth={2.5}
                fill="url(#earnings-fill)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No earnings in this window yet.
          </div>
        )}
      </div>
    </div>
  );
}
