"use client";

// Shared activity timeline — the searchable, filterable event list used by both
// the admin platform feed (/admin/activity) and the seller's own feed
// (/dashboard/activity). Each page supplies its own events + the filter set and
// renders its own stat strip above this.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  Search,
  ShoppingBag,
  Sparkles,
  UserCircle,
  UserPlus,
  Wallet,
  ShieldCheck,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ActivityModule =
  | "sale"
  | "wallet"
  | "ai"
  | "buyer"
  | "admin"
  | "signup";

export interface ActivityEvent {
  at: string;
  module: ActivityModule;
  actor: string;
  title: string;
  detail?: string;
}

const MODULE_META: Record<ActivityModule, { Icon: typeof Activity; tile: string }> = {
  sale: { Icon: ShoppingBag, tile: "tile-emerald" },
  wallet: { Icon: Wallet, tile: "tile-amber" },
  ai: { Icon: Sparkles, tile: "tile-violet" },
  buyer: { Icon: UserCircle, tile: "tile-indigo" },
  admin: { Icon: ShieldCheck, tile: "tile-rose" },
  signup: { Icon: UserPlus, tile: "tile-indigo" },
};

export interface FilterChip {
  key: "all" | ActivityModule;
  label: string;
}

export function ActivityTimeline({
  events,
  filters,
}: {
  events: ActivityEvent[];
  filters: FilterChip[];
}) {
  const [filter, setFilter] = useState<"all" | ActivityModule>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(
      (e) =>
        (filter === "all" || e.module === filter) &&
        (!q ||
          e.actor.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          (e.detail?.toLowerCase().includes(q) ?? false)),
    );
  }, [events, filter, search]);

  return (
    <div className="space-y-4">
      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} placeholder="Search activity…" onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                filter === f.key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-surface p-2">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No matching activity yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((e, i) => {
              const m = MODULE_META[e.module];
              return (
                <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                  <span aria-hidden className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", m.tile)}>
                    <m.Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-foreground">{e.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{e.actor}</span>
                    </div>
                    {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
                  </div>
                  <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(e.at), "d MMM, HH:mm")}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of {events.length.toLocaleString("en-IN")} recent events.
      </p>
    </div>
  );
}

/** Small stat tile reused by both activity pages' headline strips. */
export function ActivityStat({
  label,
  value,
  tile,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tile: string;
  icon: typeof Activity;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </p>
      </div>
    </div>
  );
}
