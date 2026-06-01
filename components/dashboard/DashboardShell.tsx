"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProfile } from "./Topbar";

interface DashboardShellProps {
  profile: TopbarProfile;
  children: ReactNode;
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showPastDue = profile.subscription_status === "past_due";

  return (
    <div className="app-canvas min-h-screen bg-background">
      {/* Past-due banner — full width, sits ABOVE the topbar so even with
          sticky topbar it's the first thing the seller sees. Inlined here
          instead of the old PastDueBanner component. */}
      {showPastDue && (
        <div className="bg-rose-600 px-4 py-2 text-center text-sm font-medium text-white">
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

      {/* ── Desktop fixed sidebar (240px = w-60) ────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-60 md:flex",
          showPastDue && "top-9", // make room for the banner so nothing overlaps
        )}
      >
        <Sidebar pathname={pathname} profile={profile} />
      </aside>

      {/* ── Mobile sidebar as a slide-in Sheet ──────────────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-60 border-0 bg-[hsl(var(--sidebar-bg))] p-0 text-[hsl(var(--sidebar-fg))]"
        >
          <Sidebar
            pathname={pathname}
            profile={profile}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="md:pl-60">
        <Topbar
          profile={profile}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

// Local cn so we don't pull in lib/utils for one classname — the only
// composition we need here is conditional + static, both supported by
// template literals. Keeps the import surface tight and obvious.
function cn(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}
