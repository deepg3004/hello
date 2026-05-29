"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar, type AdminTopbarProfile } from "./AdminTopbar";

interface AdminShellProps {
  profile: AdminTopbarProfile;
  children: ReactNode;
}

export function AdminShell({ profile, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 md:flex">
        <AdminSidebar pathname={pathname} />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 border-0 bg-zinc-950 p-0">
          <AdminSidebar pathname={pathname} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="md:pl-60">
        <AdminTopbar profile={profile} onMenuClick={() => setOpen(true)} />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
