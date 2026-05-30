"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar, type AdminTopbarProfile } from "./AdminTopbar";

interface AdminShellProps {
  profile: AdminTopbarProfile;
  /** Pending KYC submissions count — passed from layout for the sidebar badge. */
  kycPending: number;
  children: ReactNode;
}

export function AdminShell({ profile, kycPending, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 md:flex">
        <AdminSidebar
          pathname={pathname}
          profile={profile}
          kycPending={kycPending}
        />
      </aside>

      {/* Mobile slide-in */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-60 border-0 p-0"
          style={{ background: "#050810" }}
        >
          <AdminSidebar
            pathname={pathname}
            profile={profile}
            kycPending={kycPending}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="md:pl-60">
        <AdminTopbar profile={profile} onMenuClick={() => setOpen(true)} />
        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
