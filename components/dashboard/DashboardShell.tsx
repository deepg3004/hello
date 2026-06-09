"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import type { Branding } from "@/lib/settings";
import type { Role } from "@/lib/rbac";
import type { ActingAccount } from "@/lib/account-context";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProfile } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { QuickActions } from "./QuickActions";

interface DashboardShellProps {
  profile: TopbarProfile;
  branding: Branding;
  /** Seller wallet balance (paise) — shown as a chip in the header. */
  walletBalancePaise: number;
  /** Role of the logged-in user on the account being acted upon (RBAC). */
  role: Role;
  /** Accounts the user can act on (own + memberships) — drives the switcher. */
  accounts: ActingAccount[];
  /** The account currently being acted on. */
  activeOwnerId: string;
  children: ReactNode;
}

/**
 * Full-height SaaS shell. Follows the global light/dark theme — the
 * `dash-surface` marker swaps the dashboard onto the premium navy palette in
 * dark mode (see `.dark .dash-surface` in globals.css); light mode keeps the
 * cream theme. The sidebar stays dark-branded in both modes.
 */
export function DashboardShell({
  profile,
  branding,
  walletBalancePaise,
  role,
  accounts,
  activeOwnerId,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showPastDue = profile.subscription_status === "past_due";
  // The page editor runs full-screen: hide the dashboard sidebar and the
  // max-width / padding so the 30/70 (controls / live-preview) split fills the
  // whole screen.
  const isEditor = /\/dashboard\/(pages|website)\/[^/]+\/edit\/?$/.test(pathname);

  // Theme is driven globally by ThemeProvider (toggles `.dark` on <html>),
  // default light. The `dash-surface` marker makes the dashboard render its
  // premium navy palette whenever dark is active, and the cream palette in light.
  return (
    <div className="dash-surface app-canvas app-screen-h flex flex-col overflow-hidden bg-background text-foreground">
      {!isEditor && <CommandPalette />}
      {!isEditor && <QuickActions />}
      {/* Past-due banner — full width, sits above the whole layout. */}
      {showPastDue && (
        <div className="flex-shrink-0 bg-rose-600 px-4 py-2 text-center text-sm font-medium text-white">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Your subscription payment failed. Update billing to avoid page
            suspension.
            <Link
              href="/dashboard/upgrade"
              className="ml-1 underline underline-offset-2 hover:opacity-90"
            >
              Fix billing →
            </Link>
          </span>
        </div>
      )}

      {/* ── Body: fixed full-height sidebar + scrollable main column ───── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — full height, never shrinks. Hidden in the
            full-screen page editor. */}
        <aside
          className={cn(
            "hidden w-64 flex-shrink-0 border-r border-[hsl(var(--sidebar-border))]",
            !isEditor && "md:block",
          )}
        >
          <Sidebar
            pathname={pathname}
            profile={profile}
            branding={branding}
            role={role}
          />
        </aside>

        {/* Mobile sidebar — slide-in Sheet. Re-applies the dark palette since
            the Sheet portals outside the shell root. */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="dash-surface w-64 border-0 bg-[hsl(var(--sidebar-bg))] p-0"
          >
            <Sidebar
              pathname={pathname}
              profile={profile}
              branding={branding}
              role={role}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main column — fixed header, independently scrolling content. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            profile={profile}
            walletBalancePaise={walletBalancePaise}
            role={role}
            accounts={accounts}
            activeOwnerId={activeOwnerId}
            onMenuClick={() => setMobileOpen(true)}
          />
          <main
            className={cn(
              "relative flex-1 overflow-y-auto overscroll-contain bg-background",
              !isEditor && "aurora-bg grid-overlay",
              isEditor ? "p-0" : "p-4 md:p-6",
            )}
          >
            <div
              className={cn(
                "w-full",
                isEditor ? "h-full" : "mx-auto max-w-7xl animate-fade-in-scale",
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
