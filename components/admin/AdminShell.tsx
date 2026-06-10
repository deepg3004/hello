"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { Branding } from "@/lib/settings";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar, type AdminTopbarProfile } from "./AdminTopbar";

interface AdminShellProps {
  profile: AdminTopbarProfile;
  branding: Branding;
  children: ReactNode;
}

export function AdminShell({
  profile,
  branding,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Theme is driven globally by ThemeProvider (default light). `dash-surface`
  // makes admin render the premium navy palette when dark is active.
  return (
    <div className="dash-surface app-canvas min-h-screen bg-background text-foreground">
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 md:flex">
        <AdminSidebar
          pathname={pathname}
          profile={profile}
          branding={branding}
        />
      </aside>

      {/* Mobile slide-in */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="dash-surface w-60 border-0 p-0"
          style={{ background: "hsl(var(--sidebar-bg))" }}
        >
          <AdminSidebar
            pathname={pathname}
            profile={profile}
            branding={branding}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="md:pl-60">
        <AdminTopbar profile={profile} onMenuClick={() => setOpen(true)} />
        <main className="relative aurora-bg grid-overlay px-4 py-6 md:px-8 md:py-8">
          <div className="animate-fade-in-scale">{children}</div>
        </main>
      </div>
    </div>
  );
}
