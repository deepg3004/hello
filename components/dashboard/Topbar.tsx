"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, User2, Wallet } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { formatINR } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

// Re-exported so existing imports (DashboardShell, dashboard/layout.tsx) keep
// working without churn.
export interface TopbarProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

interface TopbarProps {
  profile: TopbarProfile;
  /** Seller wallet balance in paise — rendered as a live chip. */
  walletBalancePaise: number;
  onMenuClick: () => void;
}

// Low-balance thresholds mirror lib/wallet (₹200 warn, ₹50 critical).
const WALLET_WARN_PAISE = 20000;
const WALLET_CRIT_PAISE = 5000;

// Map first path segment after /dashboard to a friendly section name.
// Add a row here whenever you add a new top-level dashboard route.
const SECTION_NAMES: Record<string, string> = {
  "": "Overview",
  pages: "Pages",
  transactions: "Transactions",
  customers: "Customers",
  leads: "Leads",
  learn: "Learn",
  coupons: "Coupons",
  affiliates: "Affiliates",
  analytics: "Recovery",
  telegram: "Group Integrations",
  booking: "Booking",
  wallet: "Wallet",
  settings: "Settings",
  upgrade: "Upgrade",
  onboarding: "Get started",
  upsells: "Upsells",
};

function deriveSection(pathname: string): string {
  // /dashboard            → ""           → Overview
  // /dashboard/pages      → "pages"      → Pages
  // /dashboard/pages/abc  → "pages"      → Pages
  const m = pathname.match(/^\/dashboard\/?([^/]*)/);
  const key = (m?.[1] ?? "").toLowerCase();
  return SECTION_NAMES[key] ?? capitalize(key);
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : "Dashboard";
}

export function Topbar({
  profile,
  walletBalancePaise,
  onMenuClick,
}: TopbarProps) {
  const pathname = usePathname();
  const section = deriveSection(pathname);
  const initials = makeInitials(profile.full_name ?? profile.email);

  const walletTone =
    walletBalancePaise <= WALLET_CRIT_PAISE
      ? "border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15"
      : walletBalancePaise <= WALLET_WARN_PAISE
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
        : "border-border bg-muted/40 text-foreground hover:bg-muted";

  return (
    <header
      className={cn(
        "glass sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3",
        "border-b border-border px-4 md:px-6",
      )}
    >
      {/* Left: hamburger (mobile) / breadcrumb (desktop) */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile: small wordmark instead of breadcrumb */}
        <Link
          href="/dashboard"
          className="font-sora text-base font-semibold md:hidden"
        >
          InvoxAI
        </Link>

        {/* Desktop: InvoxAI / Section breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="hidden items-center text-sm md:flex"
        >
          <Link
            href="/dashboard"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            InvoxAI
          </Link>
          <ChevronRight className="mx-1.5 h-4 w-4 text-muted-foreground/60" />
          <span className="font-sora font-semibold text-foreground">
            {section}
          </span>
        </nav>
      </div>

      {/* Right: wallet · search · notifications · avatar */}
      <div className="flex items-center gap-1.5">
        {/* Wallet balance chip — links to the wallet page; tints amber/red as
            the balance falls toward the per-order fee floor. */}
        <Link
          href="/dashboard/wallet"
          title="InvoxAI wallet — recharge to keep your store active"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors",
            walletTone,
          )}
        >
          <Wallet className="h-3.5 w-3.5" />
          <span className="tabular-nums">{formatINR(walletBalancePaise)}</span>
        </Link>

        <GlobalSearch />

        <ThemeToggle />

        <NotificationBell accent="indigo" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex items-center gap-2 rounded-full outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9 border border-border">
                {profile.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? profile.email}
                  />
                ) : null}
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-sora text-sm font-semibold">
                  {profile.full_name ?? "Account"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <User2 className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/upgrade">Upgrade</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-700"
              onClick={async () => {
                await signOutAction();
                window.location.href = "/login";
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
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
