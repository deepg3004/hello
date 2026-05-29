"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProfile } from "./Topbar";
import { PastDueBanner } from "./PastDueBanner";

interface DashboardShellProps {
  profile: TopbarProfile;
  children: ReactNode;
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showPastDue = profile.subscription_status === "past_due";

  return (
    <div className="min-h-screen bg-muted/30">
      {showPastDue && <PastDueBanner />}

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-card md:flex">
        <Sidebar pathname={pathname} />
      </aside>

      {/* Mobile sidebar as a Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="md:pl-60">
        <Topbar profile={profile} onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
