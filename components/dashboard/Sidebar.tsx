"use client";

import Link from "next/link";
import {
  BookOpen,
  Boxes,
  CalendarClock,
  Coins,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LineChart,
  LogOut,
  Magnet,
  Megaphone,
  Settings,
  Sparkles,
  Store,
  Tag,
  Users,
  Zap,
} from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanKey } from "@/lib/plans";
import type { Branding } from "@/lib/settings";
import { cn, truncate } from "@/lib/utils";

import type { TopbarProfile } from "./Topbar";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// Three-section nav. The "Main" group is unlabeled so the first thing the eye
// catches is the brand mark + the most-used view. "Growth" + "Account" get
// quiet uppercase section headers (sidebar-fg/50 via Tailwind opacity).
const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/dashboard/pages", label: "Pages", Icon: FileText },
  { href: "/dashboard/courses", label: "Courses", Icon: BookOpen },
  { href: "/dashboard/store", label: "Store", Icon: Store },
  { href: "/dashboard/website", label: "Website", Icon: Globe },
  { href: "/dashboard/booking", label: "Booking", Icon: CalendarClock },
  { href: "/dashboard/transactions", label: "Transactions", Icon: CreditCard },
  { href: "/dashboard/learn", label: "Learn", Icon: GraduationCap },
];

// CRM — the people side: who's bought, who's interested, who dropped off.
const NAV_CRM: NavItem[] = [
  { href: "/dashboard/customers", label: "Customers", Icon: Users },
  { href: "/dashboard/leads", label: "Leads", Icon: Magnet },
  { href: "/dashboard/analytics", label: "Recovery", Icon: LineChart },
];

const NAV_GROWTH: NavItem[] = [
  { href: "/dashboard/coupons", label: "Coupons", Icon: Tag },
  { href: "/dashboard/affiliates", label: "Affiliates", Icon: Handshake },
  { href: "/dashboard/marketing", label: "Marketing", Icon: Megaphone },
  { href: "/dashboard/telegram", label: "Group Integrations", Icon: Boxes },
];

const NAV_ACCOUNT: NavItem[] = [
  { href: "/dashboard/wallet", label: "Wallet", Icon: Coins },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
];

// Sub-links shown under "Pages" when the seller is inside that section.
const PAGE_SUBNAV: { href: string; label: string }[] = [
  { href: "/dashboard/pages/payment", label: "Payment" },
  { href: "/dashboard/pages/landing", label: "Landing" },
  { href: "/dashboard/pages/leads", label: "Leads" },
];

interface SidebarProps {
  pathname: string;
  profile: TopbarProfile;
  branding: Branding;
  onNavigate?: () => void;
}

export function Sidebar({
  pathname,
  profile,
  branding,
  onNavigate,
}: SidebarProps) {
  const plan = ((profile.subscription_plan ?? "free") as PlanKey) in PLANS
    ? (profile.subscription_plan as PlanKey)
    : "free";
  const planName = PLANS[plan].name;
  const showUpgrade = plan === "free" || plan === "starter";

  return (
    <div
      className="flex h-full flex-col text-[hsl(var(--sidebar-fg))]"
      style={{ background: "#020617" }}
    >
      {/* ── Logo block ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center gap-2.5 px-5",
          // Subtle gradient hairline border below the logo block
          "after:absolute after:inset-x-4 after:bottom-0 after:h-px",
          "after:bg-gradient-to-r after:from-transparent after:via-[#7C3AED]/40 after:to-transparent",
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-brand-gradient shadow-sm shadow-black/40">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          )}
        </span>
        <div className="leading-tight">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="block font-sora text-base font-semibold tracking-tight text-white"
          >
            {branding.name}
          </Link>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--sidebar-fg))]/50">
            Seller Dashboard
          </p>
        </div>
      </div>

      {/* ── Menu (scrolls independently; profile stays pinned below) ──── */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 [scrollbar-gutter:stable]">
        <p className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--sidebar-fg))]/50">
          Main
        </p>
        {NAV_MAIN.map((item) => (
          <div key={item.href}>
            <NavRow item={item} pathname={pathname} onNavigate={onNavigate} />
            {/* Pages expands into its per-category dashboards while you're in
                that section. */}
            {item.href === "/dashboard/pages" &&
              pathname.startsWith("/dashboard/pages") && (
                <div className="ml-7 mt-0.5 space-y-0.5 border-l border-[hsl(var(--sidebar-border))] pl-2">
                  {PAGE_SUBNAV.map((sub) => {
                    const active = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onNavigate}
                        className={cn(
                          "block rounded-md px-2 py-1 text-[13px] transition",
                          active
                            ? "bg-[hsl(var(--sidebar-hover-bg))] text-white"
                            : "text-[hsl(var(--sidebar-fg))]/70 hover:text-white",
                        )}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
          </div>
        ))}

        <SectionLabel>CRM</SectionLabel>
        {NAV_CRM.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}

        <SectionLabel>Growth</SectionLabel>
        {NAV_GROWTH.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}

        <SectionLabel>Account</SectionLabel>
        {NAV_ACCOUNT.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* ── Plan card ────────────────────────────────────────────────────
          Only shown to Free/Starter as an upgrade CTA. Once a seller is on
          Pro/Business the card is removed entirely (the menu simply ends at
          Settings) — per the owner's request, no "current plan" status card. */}
      {showUpgrade && (
        <div className="shrink-0 px-3 pt-2">
          <div className="rounded-xl bg-brand-gradient p-3 text-white shadow-lg shadow-black/30">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                <Sparkles className="h-3 w-3" />
                {planName}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium leading-snug">
              Unlock more features
            </p>
            <p className="mt-0.5 text-[11px] text-white/75 leading-snug">
              Custom domains, A/B tests, affiliate system + more.
            </p>
            <Button
              asChild
              size="sm"
              className="mt-3 w-full bg-none bg-white text-[#7C3AED] hover:bg-white/90"
            >
              <Link href="/dashboard/upgrade" onClick={onNavigate}>
                Upgrade
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── User row + sign-out ──────────────────────────────────────── */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 border-t border-[#1E293B]",
          "px-3 py-3",
        )}
      >
        <Avatar className="h-9 w-9 shrink-0">
          {profile.avatar_url ? (
            <AvatarImage
              src={profile.avatar_url}
              alt={profile.full_name ?? profile.email}
            />
          ) : null}
          <AvatarFallback className="bg-[#7C3AED] text-xs text-white">
            {makeInitials(profile.full_name ?? profile.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium text-white">
            {truncate(profile.full_name ?? "Seller", 22)}
          </p>
          <p className="truncate text-[11px] text-[hsl(var(--sidebar-fg))]/60">
            {truncate(profile.email, 24)}
          </p>
        </div>
        <form
          action={async () => {
            await signOutAction();
            window.location.href = "/login";
          }}
        >
          <button
            type="submit"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-[hsl(var(--sidebar-fg))]/70 transition hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
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
  // Exact match for /dashboard (otherwise EVERY route would mark it active);
  // prefix match for child sections so /dashboard/pages/new still highlights
  // "Pages".
  const active =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-[#7C3AED]/20 text-white ring-1 ring-inset ring-[#7C3AED]/30"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
      )}
    >
      <span className={cn("nav-icon", active && "nav-icon-active-purple")}>
        <item.Icon
          className={cn(
            "h-4 w-4",
            active ? "opacity-100" : "opacity-80 group-hover:opacity-100",
          )}
        />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "mt-4 mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.12em]",
        "text-[hsl(var(--sidebar-fg))]/50",
      )}
    >
      {children}
    </p>
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
