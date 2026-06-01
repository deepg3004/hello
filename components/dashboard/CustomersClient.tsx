"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Mail, Phone, Search, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Customer | null>(null);

  // Prefill from the global command palette (/dashboard/customers?q=...).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q),
    );
  }, [search, customers]);

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
      {/* ── Search + export ──────────────────────────────────────────── */}
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
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filtered.length.toLocaleString("en-IN")} customer
          {filtered.length === 1 ? "" : "s"}
          {search ? ` matching "${search}"` : " · sorted by total spent"}
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      <ShoppingBag className="h-3 w-3" />
                      {c.total_orders}
                    </span>
                  </div>

                  {/* Total spent */}
                  <div className="font-mono text-sm font-semibold text-emerald-700 lg:w-32 lg:text-right">
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

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 ring-1 ring-inset ring-indigo-200/70">
        <ShoppingBag className="h-5 w-5 text-indigo-600" />
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
        <div className="rounded-lg border border-border bg-emerald-50/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
            Total spent
          </p>
          <p className="mt-1 font-sora text-lg font-bold text-emerald-700">
            {rupees(customer.total_spent)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-indigo-50/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-700">
            Orders
          </p>
          <p className="mt-1 font-sora text-lg font-bold text-indigo-700">
            {customer.total_orders}
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
