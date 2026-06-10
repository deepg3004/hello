"use client";

// Sonner-powered toaster (replaces the Radix toaster). Styled with the app's
// own design tokens (bg-card / border-border / text-foreground) so it follows
// the active light/dark theme automatically, with subtle per-type accents.
// All existing `toast(...)` calls flow here via hooks/use-toast.

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      gap={10}
      offset={18}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group rounded-2xl border border-border bg-card text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm p-4",
          title: "text-sm font-semibold tracking-[-0.01em]",
          description: "text-[13px] leading-relaxed text-muted-foreground",
          icon: "mt-0.5",
          closeButton:
            "border-border bg-card text-muted-foreground hover:text-foreground",
          actionButton: "rounded-lg bg-primary text-primary-foreground text-xs font-medium",
          cancelButton: "rounded-lg bg-muted text-muted-foreground text-xs font-medium",
          error: "!border-destructive/40",
          success: "!border-emerald-500/40",
          warning: "!border-amber-500/40",
        },
      }}
    />
  );
}
