"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bell,
  Blocks,
  Coins,
  Contact,
  Film,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Plug,
  Receipt,
  ScrollText,
  Send,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Store,
  Ticket,
  UserCircle,
  Users,
} from "lucide-react";

import type { Branding } from "@/lib/settings";
import { cn } from "@/lib/utils";

import type { AdminTopbarProfile } from "./AdminTopbar";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** When set, render a small badge next to the label (e.g. KYC queue count). */
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  pathname: string;
  profile: AdminTopbarProfile;
  branding: Branding;
  onNavigate?: () => void;
}

export function AdminSidebar({
  pathname,
  profile,
  branding,
  onNavigate,
}: AdminSidebarProps) {
  const groups: NavGroup[] = [
    {
      label: "Operations",
      items: [
        { href: "/admin", label: "Overview", Icon: LayoutDashboard },
        { href: "/admin/users", label: "Users", Icon: Users },
        { href: "/admin/pages", label: "Pages", Icon: FileText },
        { href: "/admin/transactions", label: "Transactions", Icon: CreditCard },
        { href: "/admin/seller-wallets", label: "Seller Wallets", Icon: Coins },
        { href: "/admin/gateways", label: "Gateways", Icon: Plug },
      ],
    },
    {
      label: "Data",
      items: [
        { href: "/admin/customers", label: "Customers", Icon: Contact },
        { href: "/admin/buyers", label: "Buyer Accounts", Icon: UserCircle },
        { href: "/admin/store", label: "Store", Icon: Store },
        { href: "/admin/coupons", label: "Coupons", Icon: Ticket },
        { href: "/admin/invoxai-tr", label: "InvoxAI-TR", Icon: Receipt },
        { href: "/admin/domains", label: "Domains", Icon: Globe },
      ],
    },
    {
      label: "Compliance",
      items: [
        { href: "/admin/telegram", label: "Telegram", Icon: Send },
        { href: "/admin/support", label: "Support", Icon: LifeBuoy },
      ],
    },
    {
      label: "Ops",
      items: [
        { href: "/admin/system-health", label: "System Health", Icon: Activity },
        { href: "/admin/risk", label: "Risk & Abuse", Icon: ShieldAlert },
        { href: "/admin/notifications", label: "Notifications", Icon: Bell },
        { href: "/admin/broadcast", label: "Broadcast", Icon: Megaphone },
        { href: "/admin/transcodes", label: "Video DRM", Icon: Film },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/learn", label: "Creator Academy", Icon: GraduationCap },
        { href: "/admin/integrations", label: "Integrations", Icon: Blocks },
        { href: "/admin/email", label: "Email", Icon: Mail },
        { href: "/admin/credentials", label: "Credentials", Icon: KeyRound },
        { href: "/admin/settings", label: "Platform Settings", Icon: Sliders },
        { href: "/admin/activity", label: "Activity", Icon: History },
        { href: "/admin/audit-logs", label: "Audit Logs", Icon: ScrollText },
      ],
    },
  ];

  return (
    <div
      className="flex h-full flex-col text-[hsl(var(--sidebar-fg))]"
      style={{ background: "hsl(var(--sidebar-bg))" }}
    >
      {/* ── Logo block (h-16 to match user sidebar) ─────────────────── */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center gap-2.5 px-5",
          // Amber hairline below — admin signal
          "after:absolute after:inset-x-4 after:bottom-0 after:h-px",
          "after:bg-gradient-to-r after:from-transparent after:via-amber-500/40 after:to-transparent",
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400 shadow-sm shadow-amber-900/40">
          <ShieldCheck className="h-4 w-4 text-zinc-950" strokeWidth={2.5} />
        </span>
        <div className="leading-tight">
          <Link
            href="/admin"
            onClick={onNavigate}
            className="block font-sora text-base font-semibold tracking-tight text-[hsl(var(--sidebar-fg-strong))]"
          >
            {branding.name}
          </Link>
          <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-300/70">
            Admin Console
          </p>
        </div>
      </div>

      {/* ── Nav groups ──────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 [scrollbar-gutter:stable]">
        {groups.map((g, gi) => (
          <div key={g.label} className={gi === 0 ? "" : "mt-4"}>
            <p className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--sidebar-fg))]/50">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Back-to-seller link ─────────────────────────────────────── */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(
          "mx-3 mt-3 flex items-center gap-2 rounded-lg px-3 py-2",
          "text-xs font-medium text-[hsl(var(--sidebar-fg))] transition",
          "hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-fg-strong))]",
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Seller dashboard
      </Link>

      {/* ── Admin identity row ──────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-3 py-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-zinc-950"
        >
          {makeInitials(profile.full_name ?? profile.email)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium text-[hsl(var(--sidebar-fg-strong))]">
            {profile.full_name ?? "Admin"}
          </p>
          <p className="truncate text-[11px] text-[hsl(var(--sidebar-fg))]/60">{profile.email}</p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">
          Admin
        </span>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function NavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-amber-400/15 text-[hsl(var(--sidebar-fg-strong))] ring-1 ring-inset ring-amber-500/30"
          : "text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-fg-strong))]",
      )}
    >
      <span className={cn("nav-icon", active && "nav-icon-active-amber")}>
        <item.Icon
          className={cn(
            "h-4 w-4",
            active ? "opacity-100" : "opacity-80 group-hover:opacity-100",
          )}
        />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {/* Red badge for KYC queue (and any future counter) — hidden when 0 */}
      {item.badge != null && item.badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

function makeInitials(s: string): string {
  return s
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
