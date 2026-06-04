"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CornerDownLeft,
  CreditCard,
  FileText,
  Handshake,
  LayoutDashboard,
  LineChart,
  Loader2,
  Magnet,
  Search,
  Send,
  Settings,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatINR } from "@/lib/utils";

// Static destinations — always searchable, instant navigation. Icons mirror
// the sidebar exactly so each page shows its own recognisable mark.
const NAV: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: "Overview", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Pages", href: "/dashboard/pages", Icon: FileText },
  { label: "Transactions", href: "/dashboard/transactions", Icon: CreditCard },
  { label: "Customers", href: "/dashboard/customers", Icon: Users },
  { label: "Leads", href: "/dashboard/leads", Icon: Magnet },
  { label: "Coupons", href: "/dashboard/coupons", Icon: Tag },
  { label: "Affiliates", href: "/dashboard/affiliates", Icon: Handshake },
  { label: "Recovery", href: "/dashboard/analytics", Icon: LineChart },
  { label: "Telegram", href: "/dashboard/telegram", Icon: Send },
  { label: "Wallet", href: "/dashboard/wallet", Icon: Wallet },
  { label: "Settings", href: "/dashboard/settings", Icon: Settings },
];

// Page-type → icon, matching how each page type reads elsewhere in the app.
const PAGE_TYPE_ICON: Record<string, LucideIcon> = {
  payment: CreditCard,
  landing: FileText,
  lead_magnet: Magnet,
};

type Tint = "indigo" | "emerald" | "amber" | "sky";
const TINTS: Record<Tint, { tile: string; icon: string }> = {
  indigo: {
    tile: "from-indigo-50 to-indigo-100/60 ring-indigo-200/70",
    icon: "text-indigo-600",
  },
  emerald: {
    tile: "from-emerald-50 to-emerald-100/60 ring-emerald-200/70",
    icon: "text-emerald-600",
  },
  amber: {
    tile: "from-amber-50 to-amber-100/60 ring-amber-200/70",
    icon: "text-amber-600",
  },
  sky: {
    tile: "from-sky-50 to-sky-100/60 ring-sky-200/70",
    icon: "text-sky-600",
  },
};

interface SearchResults {
  pages: { id: string; title: string; type: string }[];
  customers: { name: string | null; email: string }[];
  transactions: {
    id: string;
    buyer: string | null;
    amount: number;
    status: string;
    created_at: string;
  }[];
}

interface Item {
  key: string;
  label: string;
  sub: string;
  href: string;
  Icon: LucideIcon;
  tint: Tint;
}

const EMPTY: SearchResults = { pages: [], customers: [], transactions: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(EMPTY);
      setActive(0);
      // Focus after the dialog mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced remote search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setResults((await res.json()) as SearchResults);
      } catch {
        /* aborted or offline — ignore */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Flatten everything into one navigable list. All nav destinations are
  // always shown (filtered by the query when typing) so nothing is hidden.
  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const nav: Item[] = (
      q ? NAV.filter((n) => n.label.toLowerCase().includes(q)) : NAV
    ).map((n) => ({
      key: `nav:${n.href}`,
      label: n.label,
      sub: "Go to page",
      href: n.href,
      Icon: n.Icon,
      tint: "indigo",
    }));
    const pages: Item[] = results.pages.map((p) => ({
      key: `page:${p.id}`,
      label: p.title,
      sub: `Page · ${p.type.replace(/_/g, " ")}`,
      href: `/dashboard/pages/${p.id}/edit`,
      Icon: PAGE_TYPE_ICON[p.type] ?? FileText,
      tint: "indigo",
    }));
    const customers: Item[] = results.customers.map((c) => ({
      key: `cust:${c.email}`,
      label: c.name || c.email,
      sub: c.email,
      href: `/dashboard/customers?q=${encodeURIComponent(c.email)}`,
      Icon: Users,
      tint: "amber",
    }));
    const txns: Item[] = results.transactions.map((t) => ({
      key: `txn:${t.id}`,
      label: t.buyer || "Order",
      sub: `${formatINR(Math.round(t.amount * 100))} · ${t.status}`,
      href: `/dashboard/transactions?q=${encodeURIComponent(t.buyer || "")}`,
      Icon: CreditCard,
      tint: "emerald",
    }));
    return [...nav, ...pages, ...customers, ...txns];
  }, [query, results]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) go(item.href);
    }
  }

  return (
    <>
      {/* Desktop trigger — a premium pill with a gradient search tile. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="group hidden h-9 w-64 items-center gap-2.5 rounded-xl border border-border bg-gradient-to-r from-card to-card/50 pl-2 pr-2 text-sm text-muted-foreground shadow-sm transition-all hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/10 lg:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100/60 ring-1 ring-inset ring-indigo-200/70 transition-colors group-hover:from-indigo-100 group-hover:to-violet-100/70">
          <Search className="h-3.5 w-3.5 text-indigo-600" />
        </span>
        <span className="flex-1 text-left transition-colors group-hover:text-foreground">
          Search…
        </span>
        <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      {/* Compact trigger for < lg. */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground lg:hidden"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>

          {/* Input row */}
          <div className="flex items-center gap-3 border-b border-border px-4">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages, customers, transactions…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {query.trim().length < 2
                  ? "Type to search across your store."
                  : loading
                    ? "Searching…"
                    : "No matches."}
              </p>
            ) : (
              <ul className="px-2">
                {items.map((item, i) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        i === active ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-inset",
                          TINTS[item.tint].tile,
                        )}
                      >
                        <item.Icon className={cn("h-4 w-4", TINTS[item.tint].icon)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.sub}
                        </span>
                      </span>
                      {i === active && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">esc</kbd>
              close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
