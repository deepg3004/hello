"use client";

import { IndianRupee, Sparkles, UserCircle, Users } from "lucide-react";

import {
  ActivityTimeline,
  ActivityStat,
  type ActivityEvent,
  type FilterChip,
} from "@/components/shared/ActivityTimeline";

export type { ActivityEvent, ActivityModule } from "@/components/shared/ActivityTimeline";

export interface ActivityStats {
  sellers: number;
  buyers: number;
  ordersThisMonth: number;
  aiThisMonth: number;
}

const FILTERS: FilterChip[] = [
  { key: "all", label: "All" },
  { key: "sale", label: "Sales" },
  { key: "wallet", label: "Wallet" },
  { key: "ai", label: "AI" },
  { key: "buyer", label: "Buyers" },
  { key: "signup", label: "Signups" },
  { key: "admin", label: "Admin" },
];

export function AdminActivityClient({
  events,
  stats,
}: {
  events: ActivityEvent[];
  stats: ActivityStats;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ActivityStat label="Sellers" value={stats.sellers} tile="tile-indigo" icon={Users} />
        <ActivityStat label="Buyer accounts" value={stats.buyers} tile="tile-violet" icon={UserCircle} />
        <ActivityStat label="Orders this month" value={stats.ordersThisMonth} tile="tile-emerald" icon={IndianRupee} />
        <ActivityStat label="AI pages this month" value={stats.aiThisMonth} tile="tile-amber" icon={Sparkles} />
      </div>
      <ActivityTimeline events={events} filters={FILTERS} />
    </div>
  );
}
