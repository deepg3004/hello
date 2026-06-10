"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarClock,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LayoutTemplate,
  LineChart,
  LogOut,
  Magnet,
  Megaphone,
  Target,
  Palette,
  Settings,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanKey } from "@/lib/plans";
import type { Branding } from "@/lib/settings";
import { can, type Capability, type Module, type Role } from "@/lib/rbac";
import { cn, truncate } from "@/lib/utils";

import type { TopbarProfile } from "./Topbar";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** RBAC module gating visibility. Omitted = always visible to any actor. */
  module?: Module;
}

// Three-section nav. The "Main" group is unlabeled so the first thing the eye
// catches is the brand mark + the most-used view. "Growth" + "Account" get
// quiet uppercase section headers (sidebar-fg/50 via Tailwind opacity).
const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/dashboard/pages", label: "Pages", Icon: FileText, module: "pages" },
  { href: "/dashboard/courses", label: "Courses", Icon: BookOpen, module: "courses" },
  { href: "/dashboard/store", label: "Store", Icon: Store, module: "store" },
  { href: "/dashboard/storefront-design", label: "Storefront Design", Icon: Palette, module: "store" },
  { href: "/dashboard/website", label: "Website", Icon: Globe, module: "website" },
  { href: "/dashboard/builder/templates", label: "Builder (beta)", Icon: LayoutTemplate, module: "website" },
  { href: "/dashboard/booking", label: "Booking", Icon: CalendarClock, module: "booking" },
  { href: "/dashboard/transactions", label: "Transactions", Icon: CreditCard, module: "transactions" },
  { href: "/dashboard/insights", label: "Insights", Icon: BarChart3, module: "transactions" },
  { href: "/dashboard/learn", label: "Learn", Icon: GraduationCap },
];

// CRM — the people side: who's bought, who's interested, who dropped off.
const NAV_CRM: NavItem[] = [
  { href: "/dashboard/customers", label: "Customers", Icon: Users, module: "customers" },
  { href: "/dashboard/leads", label: "Leads", Icon: Magnet, module: "leads" },
  { href: "/dashboard/analytics", label: "Recovery", Icon: LineChart, module: "analytics" },
];

const NAV_GROWTH: NavItem[] = [
  { href: "/dashboard/coupons", label: "Coupons", Icon: Tag, module: "coupons" },
  { href: "/dashboard/upsells", label: "Upsells", Icon: TrendingUp, module: "pages" },
  { href: "/dashboard/affiliates", label: "Affiliates", Icon: Handshake, module: "affiliates" },
  { href: "/dashboard/marketing", label: "Marketing", Icon: Megaphone, module: "marketing" },
  { href: "/dashboard/tracking", label: "Ads Tracking", Icon: Target, module: "marketing" },
  { href: "/dashboard/marketing/sequences", label: "Email Sequences", Icon: Workflow, module: "marketing" },
  { href: "/dashboard/telegram", label: "Group Integrations", Icon: Boxes, module: "telegram" },
];

const NAV_ACCOUNT: NavItem[] = [
  { href: "/dashboard/activity", label: "Activity", Icon: Activity },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
];

// Settings is a hub — show it when the actor can reach at least one setting.
const SETTINGS_MODULES: Module[] = [
  "domains",
  "notifications",
  "email",
  "billing",
  "gateway",
  "team",
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
  role: Role;
  onNavigate?: () => void;
}

export function Sidebar({
  pathname,
  profile,
  branding,
  role,
  onNavigate,
}: SidebarProps) {
  const plan = ((profile.subscription_plan ?? "free") as PlanKey) in PLANS
    ? (profile.subscription_plan as PlanKey)
    : "free";
  const planName = PLANS[plan].name;
  const showUpgrade = plan === "free" || plan === "starter";

  // RBAC: hide nav the role can't even view. Settings shows when ANY setting
  // is reachable. Upgrade card is owner-only (billing).
  const visible = (item: NavItem) =>
    !item.module || can(role, `${item.module}.view` as Capability);
  const navMain = NAV_MAIN.filter(visible);
  const navCrm = NAV_CRM.filter(visible);
  // CRM is a parent that expands its sub-views when you're inside any of them.
  const crmActive = navCrm.some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );
  const navGrowth = NAV_GROWTH.filter(visible);
  const canSettings = SETTINGS_MODULES.some((m) =>
    can(role, `${m}.view` as Capability),
  );
  const navAccount = NAV_ACCOUNT.filter(
    (item) =>
      (item.href !== "/dashboard/settings" || canSettings) && visible(item),
  );
  const canBilling = can(role, "billing.manage");

  return (
    <div
      className="flex h-full flex-col text-[hsl(var(--sidebar-fg))]"
      style={{ background: "hsl(var(--sidebar-bg))" }}
    >
      {/* ── Logo block ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center gap-2.5 px-5",
          // Subtle gradient hairline border below the logo block
          "after:absolute after:inset-x-4 after:bottom-0 after:h-px",
          "after:bg-gradient-to-r after:from-transparent after:via-[hsl(var(--sidebar-active-bg))]/40 after:to-transparent",
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
            className="block font-sora text-base font-semibold tracking-tight text-[hsl(var(--sidebar-fg-strong))]"
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
        {navMain.map((item) => (
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
                            ? "bg-[hsl(var(--sidebar-hover-bg))] text-[hsl(var(--sidebar-fg-strong))]"
                            : "text-[hsl(var(--sidebar-fg))]/80 hover:text-[hsl(var(--sidebar-fg-strong))]",
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

        {navCrm.length > 0 && (
          <div className="mt-1">
            <Link
              href={navCrm[0]!.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
                crmActive
                  ? "bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))] shadow-sm"
                  : "text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-fg-strong))]",
              )}
            >
              <span
                className={cn("nav-icon", crmActive && "nav-icon-active-purple")}
              >
                <Users className="h-4 w-4 opacity-90" />
              </span>
              <span className="flex-1 truncate">CRM</span>
            </Link>
            {crmActive && (
              <div className="ml-7 mt-0.5 space-y-0.5 border-l border-[hsl(var(--sidebar-border))] pl-2">
                {navCrm.map((sub) => {
                  const active =
                    pathname === sub.href ||
                    pathname.startsWith(`${sub.href}/`);
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-md px-2 py-1 text-[13px] transition",
                        active
                          ? "bg-[hsl(var(--sidebar-hover-bg))] text-[hsl(var(--sidebar-fg-strong))]"
                          : "text-[hsl(var(--sidebar-fg))]/80 hover:text-[hsl(var(--sidebar-fg-strong))]",
                      )}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {navGrowth.length > 0 && <SectionLabel>Growth</SectionLabel>}
        {navGrowth.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}

        {navAccount.length > 0 && <SectionLabel>Account</SectionLabel>}
        {navAccount.map((item) => (
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
      {showUpgrade && canBilling && (
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
              className="mt-3 w-full bg-none bg-white text-primary hover:bg-white/90"
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
          "flex shrink-0 items-center gap-3 border-t border-[hsl(var(--sidebar-border))]",
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
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">
            {makeInitials(profile.full_name ?? profile.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium text-[hsl(var(--sidebar-fg-strong))]">
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
            className="rounded-md p-1.5 text-[hsl(var(--sidebar-fg))]/70 transition hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-fg-strong))]"
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
          ? "bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))] shadow-sm"
          : "text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-fg-strong))]",
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
