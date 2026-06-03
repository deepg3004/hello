"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Crown,
  Download,
  Mail,
  Phone,
  Search,
  ShoppingBag,
} from "lucide-react";

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

export interface CustomerOrder {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  page_title: string | null;
}

export interface Customer {
  email: string;
  name: string | null;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  last_purchase_at: string;
  first_page_title: string | null;
  orders: CustomerOrder[];
}

const rupees = (n: number) => formatINR(n * 100);

// Five-stop gradient palette — pick deterministically per customer by hashing
// the email so the same person always renders with the same colours.
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
] as const;

function hashStringToIndex(s: string, mod: number): number {
  // Cheap FNV-1a-ish — collision-resistant enough for 5 buckets.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

function gradientFor(email: string): string {
  return AVATAR_GRADIENTS[hashStringToIndex(email, AVATAR_GRADIENTS.length)]!;
}

function initialsFor(c: Customer): string {
  const src = c.name?.trim() || c.email;
  return src
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const csvEscape = (s: unknown) => {
  const v = s == null ? "" : String(s);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

type Segment = "all" | "new" | "repeat" | "vip";
type SortKey = "spent" | "orders" | "recent" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "spent", label: "Highest spend" },
  { key: "orders", label: "Most orders" },
  { key: "recent", label: "Recent purchase" },
  { key: "name", label: "Name A–Z" },
];

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<SortKey>("spent");
  const [active, setActive] = useState<Customer | null>(null);

  // Prefill from the global command palette (/dashboard/customers?q=...).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, []);

  // VIP = spend in the top 10% of all customers (≥1 paid order).
  const vipThreshold = useMemo(() => {
    const spends = customers
      .map((c) => c.total_spent)
      .filter((n) => n > 0)
      .sort((a, b) => b - a);
    if (spends.length === 0) return Infinity;
    const idx = Math.max(0, Math.floor(spends.length * 0.1) - 1);
    return spends[idx] ?? Infinity;
  }, [customers]);
  const isVip = (c: Customer) => c.total_spent > 0 && c.total_spent >= vipThreshold;

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q),
    );
  }, [search, customers]);

  const segCounts = useMemo(
    () => ({
      all: searched.length,
      new: searched.filter((c) => c.total_orders === 1).length,
      repeat: searched.filter((c) => c.total_orders >= 2).length,
      vip: searched.filter(isVip).length,
    }),
    [searched, vipThreshold],
  );

  const filtered = useMemo(() => {
    let list = searched;
    if (segment === "new") list = list.filter((c) => c.total_orders === 1);
    else if (segment === "repeat") list = list.filter((c) => c.total_orders >= 2);
    else if (segment === "vip") list = list.filter(isVip);

    const sorted = [...list];
    switch (sort) {
      case "orders":
        sorted.sort((a, b) => b.total_orders - a.total_orders);
        break;
      case "recent":
        sorted.sort(
          (a, b) =>
            new Date(b.last_purchase_at).getTime() -
            new Date(a.last_purchase_at).getTime(),
        );
        break;
      case "name":
        sorted.sort((a, b) =>
          (a.name ?? a.email).localeCompare(b.name ?? b.email),
        );
        break;
      default:
        sorted.sort((a, b) => b.total_spent - a.total_spent);
    }
    return sorted;
  }, [searched, segment, sort, vipThreshold]);

  function exportCsv() {
    const header = [
      "email",
      "name",
      "phone",
      "total_orders",
      "total_spent",
      "last_purchase_at",
      "first_page",
    ];
    const lines = [header.join(",")];
    for (const c of filtered) {
      lines.push(
        [
          c.email,
          c.name ?? "",
          c.phone ?? "",
          c.total_orders,
          c.total_spent,
          c.last_purchase_at,
          c.first_page_title ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoxai-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* ── Search + sort + export ───────────────────────────────────── */}
      <div className="card-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[170px]">
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
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        {/* Segment chips with live counts */}
        <div className="mt-3 flex flex-wrap gap-2">
          <SegChip label="All" count={segCounts.all} active={segment === "all"} onClick={() => setSegment("all")} />
          <SegChip label="New" count={segCounts.new} active={segment === "new"} tone="indigo" onClick={() => setSegment(segment === "new" ? "all" : "new")} />
          <SegChip label="Repeat" count={segCounts.repeat} active={segment === "repeat"} tone="emerald" onClick={() => setSegment(segment === "repeat" ? "all" : "repeat")} />
          <SegChip label="VIP" count={segCounts.vip} active={segment === "vip"} tone="amber" icon={Crown} onClick={() => setSegment(segment === "vip" ? "all" : "vip")} />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {filtered.length.toLocaleString("en-IN")} customer
          {filtered.length === 1 ? "" : "s"}
          {search ? ` matching "${search}"` : ""}
        </p>
      </div>

      {/* ── Customer list — table on lg+, card stack on smaller ──────── */}
      <div className="card-surface mt-4 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <>
            {/* Column header (visible on lg+) */}
            <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:grid">
              <div>Customer</div>
              <div className="w-20 text-center">Orders</div>
              <div className="w-32 text-right">Total spent</div>
              <div className="w-36 text-right">Last purchase</div>
            </div>

            <ul className="divide-y divide-border">
              {filtered.map((c) => (
                <li
                  key={c.email}
                  onClick={() => setActive(c)}
                  className={cn(
                    "group grid cursor-pointer grid-cols-1 gap-4 px-5 py-4 transition-colors",
                    "hover:bg-muted/30",
                    "lg:grid-cols-[1fr_auto_auto_auto] lg:items-center",
                  )}
                >
                  {/* Avatar + name + email */}
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                        "bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
                        gradientFor(c.email),
                      )}
                    >
                      {initialsFor(c)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground group-hover:text-primary">
                        {c.name ?? c.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.name ? c.email : c.phone ?? c.email}
                      </p>
                    </div>
                  </div>

                  {/* Orders badge */}
                  <div className="lg:w-20 lg:text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      <ShoppingBag className="h-3 w-3" />
                      {c.total_orders}
                    </span>
                  </div>

                  {/* Total spent */}
                  <div className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400 lg:w-32 lg:text-right">
                    {rupees(c.total_spent)}
                  </div>

                  {/* Last purchase */}
                  <div className="text-xs text-muted-foreground lg:w-36 lg:text-right">
                    {formatDate(c.last_purchase_at)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── Slide-out detail Sheet ───────────────────────────────────── */}
      <Sheet
        open={!!active}
        onOpenChange={(open) => !open && setActive(null)}
      >
        <SheetContent className="w-full bg-card sm:max-w-md">
          {active && <CustomerDetail customer={active} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

const SEG_ACTIVE: Record<string, string> = {
  all: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  indigo: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  emerald: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
};

function SegChip({
  label,
  count,
  active,
  tone,
  icon: Icon,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: string;
  icon?: typeof Crown;
  onClick: () => void;
}) {
  const activeCls = SEG_ACTIVE[tone ?? "all"] ?? SEG_ACTIVE.all;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
        active
          ? activeCls
          : "border border-border bg-card text-muted-foreground ring-transparent hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-white/40 dark:bg-white/15" : "bg-muted",
        )}
      >
        {count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 ring-1 ring-inset ring-indigo-200/70 dark:from-indigo-500/15 dark:to-indigo-500/5 dark:ring-indigo-500/30">
        <ShoppingBag className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
      </div>
      <div>
        <p className="font-medium text-foreground">
          {search ? "No customers match" : "No customers yet"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {search
            ? `Nothing matched "${search}". Try a shorter query.`
            : "Once you make your first sale, the buyer will appear here."}
        </p>
      </div>
    </div>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const avgOrder =
    customer.total_orders > 0 ? customer.total_spent / customer.total_orders : 0;
  const customerSince = customer.orders.length
    ? customer.orders.reduce(
        (min, o) => (o.created_at < min ? o.created_at : min),
        customer.orders[0]!.created_at,
      )
    : customer.last_purchase_at;

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-br text-base font-semibold text-white shadow-md",
              gradientFor(customer.email),
            )}
          >
            {initialsFor(customer)}
          </span>
          <div className="min-w-0">
            <SheetTitle className="truncate font-sora text-lg">
              {customer.name ?? customer.email}
            </SheetTitle>
            <SheetDescription className="truncate">
              {customer.email}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* Contact strip */}
      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <a
            href={`mailto:${customer.email}`}
            className="text-foreground hover:underline"
          >
            {customer.email}
          </a>
        </div>
        {customer.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <a
              href={`tel:${customer.phone}`}
              className="text-foreground hover:underline"
            >
              {customer.phone}
            </a>
          </div>
        )}
      </div>

      {/* Quick-stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-emerald-50/40 p-3 dark:bg-emerald-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            Total spent
          </p>
          <p className="mt-1 font-sora text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {rupees(customer.total_spent)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-indigo-50/40 p-3 dark:bg-indigo-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
            Orders
          </p>
          <p className="mt-1 font-sora text-lg font-bold text-indigo-700 dark:text-indigo-300">
            {customer.total_orders}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-violet-50/40 p-3 dark:bg-violet-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300">
            Avg order
          </p>
          <p className="mt-1 font-sora text-lg font-bold text-violet-700 dark:text-violet-300">
            {rupees(avgOrder)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Customer since
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {formatDate(customerSince)}
          </p>
        </div>
      </div>

      {/* Order history list */}
      <div className="mt-6">
        <h3 className="mb-2 font-sora text-sm font-semibold tracking-tight">
          Order history
        </h3>
        <ul className="space-y-2">
          {customer.orders.map((o) => (
            <li
              key={o.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {o.page_title ?? "Order"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(o.created_at)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono text-sm font-semibold">
                  {rupees(o.amount)}
                </span>
                <StatusBadge status={o.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
