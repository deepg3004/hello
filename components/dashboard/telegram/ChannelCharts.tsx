"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatINR } from "@/lib/utils";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

// Dark-aware tooltip popover (recharts defaults to white — jarring on dark).
const CHART_TOOLTIP = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
} as const;

export function RevenueByDayChart({
  data,
}: {
  data: Array<{ date: string; amount: number; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No sales data yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="hsl(var(--muted-foreground))"
          tickFormatter={(v: number) => `₹${v}`}
        />
        <Tooltip
          formatter={(value) => [formatINR(Number(value ?? 0) * 100), "Revenue"]}
          labelFormatter={(label) => String(label)}
          contentStyle={CHART_TOOLTIP}
          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MembersByPlanChart({
  data,
}: {
  data: Array<{ plan_name: string; count: number; revenue: number }>;
}) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No subscribers yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="count"
          nameKey="plan_name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {filtered.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${Number(value ?? 0)} members`, String(name)]}
          contentStyle={CHART_TOOLTIP}
          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
