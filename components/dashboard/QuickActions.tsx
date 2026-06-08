"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  LifeBuoy,
  Package,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Create a page", href: "/dashboard/pages/new", icon: FileText },
  { label: "Store & products", href: "/dashboard/store", icon: Package },
  { label: "Recharge wallet", href: "/dashboard/wallet", icon: Wallet },
];
const HELP: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Resources & guides", href: "/dashboard/learn", icon: BookOpen },
  { label: "Get support", href: "/dashboard/support", icon: LifeBuoy },
];

/** Floating quick-actions + help launcher (premium FAB). Mounted in the
 *  dashboard shell. Not an LLM assistant — a fast hub for common tasks. */
export function QuickActions() {
  const [open, setOpen] = useState(false);

  const Row = ({ a }: { a: { label: string; href: string; icon: LucideIcon } }) => (
    <Link
      href={a.href}
      onClick={() => setOpen(false)}
      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
    >
      <a.icon className="h-4 w-4 shrink-0 text-primary" />
      {a.label}
    </Link>
  );

  return (
    <>
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden">
        {open && (
          <div className="w-64 animate-fade-in-scale rounded-2xl border border-border bg-card/95 p-2 shadow-card-lg backdrop-blur-xl dark:ring-1 dark:ring-inset dark:ring-white/[0.06]">
            <p className="th-label px-2 pb-1 pt-1.5">Quick actions</p>
            {ACTIONS.map((a) => (
              <Row key={a.href} a={a} />
            ))}
            <div className="my-1.5 h-px bg-border" />
            <p className="th-label px-2 pb-1">Help</p>
            {HELP.map((a) => (
              <Row key={a.href} a={a} />
            ))}
            <div className="my-1.5 h-px bg-border" />
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              Press{" "}
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">
                ⌘K
              </kbd>{" "}
              to search anything
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close quick actions" : "Quick actions"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform hover:scale-105 active:scale-95",
          )}
        >
          {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
