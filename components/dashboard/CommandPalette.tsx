"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  CalendarClock,
  Contact,
  CreditCard,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Palette,
  Receipt,
  Search,
  Settings,
  Store,
  Tag,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Cmd {
  label: string;
  href: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
}

// Curated navigation targets — mirrors the sidebar. Fast jump-to from anywhere.
const COMMANDS: Cmd[] = [
  { label: "Overview", href: "/dashboard", group: "Main", icon: LayoutDashboard, keywords: "home dashboard" },
  { label: "Pages", href: "/dashboard/pages", group: "Main", icon: CreditCard, keywords: "payment landing checkout" },
  { label: "Courses", href: "/dashboard/courses", group: "Main", icon: BarChart3, keywords: "lms learning" },
  { label: "Store", href: "/dashboard/store", group: "Main", icon: Store, keywords: "products catalog orders" },
  { label: "Storefront Design", href: "/dashboard/storefront-design", group: "Main", icon: Palette, keywords: "theme branding" },
  { label: "Website", href: "/dashboard/website", group: "Main", icon: Globe, keywords: "site builder" },
  { label: "Booking", href: "/dashboard/booking", group: "Main", icon: CalendarClock, keywords: "calendar appointments" },
  { label: "Transactions", href: "/dashboard/transactions", group: "Main", icon: Receipt, keywords: "payments revenue" },
  { label: "Customers", href: "/dashboard/customers", group: "CRM", icon: Contact, keywords: "buyers" },
  { label: "Leads", href: "/dashboard/leads", group: "CRM", icon: Users, keywords: "captures" },
  { label: "Recovery", href: "/dashboard/analytics", group: "CRM", icon: BarChart3, keywords: "abandoned cart analytics" },
  { label: "Coupons", href: "/dashboard/coupons", group: "Growth", icon: Ticket, keywords: "discount promo" },
  { label: "Affiliates", href: "/dashboard/affiliates", group: "Growth", icon: Tag, keywords: "referral" },
  { label: "Marketing", href: "/dashboard/marketing", group: "Growth", icon: Megaphone, keywords: "pixels webhook email" },
  { label: "Group Integrations", href: "/dashboard/telegram", group: "Growth", icon: Boxes, keywords: "telegram discord vip" },
  { label: "Wallet", href: "/dashboard/wallet", group: "Account", icon: Wallet, keywords: "balance recharge" },
  { label: "Settings", href: "/dashboard/settings", group: "Account", icon: Settings, keywords: "profile team gateway email domain" },
  { label: "Gateway settings", href: "/dashboard/settings/gateway", group: "Account", icon: CreditCard, keywords: "razorpay cashfree payment" },
  { label: "Team & Roles", href: "/dashboard/settings/team", group: "Account", icon: Users, keywords: "members rbac" },
  { label: "Support", href: "/dashboard/support", group: "Account", icon: LifeBuoy, keywords: "help ticket" },
];

/** Raycast/Linear-style ⌘K command palette for fast navigation. Mounted once
 *  in the dashboard shell; toggled with ⌘K / Ctrl+K. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COMMANDS;
    return COMMANDS.filter((c) =>
      `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(s),
    );
  }, [q]);

  useEffect(() => setSel(0), [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const c = filtered[sel];
                if (c) go(c.href);
              }
            }}
            placeholder="Jump to…  (pages, settings, actions)"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No matches for “{q}”.
            </p>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.href}
                type="button"
                onClick={() => go(c.href)}
                onMouseEnter={() => setSel(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  i === sel
                    ? "bg-primary/15 text-foreground ring-1 ring-inset ring-primary/25"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <c.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-foreground">{c.label}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">
                  {c.group}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
