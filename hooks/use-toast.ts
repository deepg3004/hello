"use client";

// Toast facade — forwards to Sonner while keeping the existing
// `toast({ title, description, variant })` API so no call-site has to change.
// (Replaces the previous Radix toast reducer; the <Toaster> in app/layout uses
// Sonner — see components/ui/toaster.tsx.)

import type { ReactNode } from "react";
import { toast as sonner } from "sonner";

export interface ToastInput {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
}

function toast({ title, description, variant, duration }: ToastInput = {}) {
  // If only a description was given, promote it to the message.
  const message = (title ?? description ?? "") as ReactNode;
  const opts: { description?: ReactNode; duration?: number } = { duration };
  if (title && description) opts.description = description;

  const id =
    variant === "destructive"
      ? sonner.error(message || "Something went wrong", opts)
      : sonner(message, opts);

  return {
    id,
    dismiss: () => sonner.dismiss(id),
    update: () => {
      /* no-op — kept for API compatibility */
    },
  };
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string | number) => sonner.dismiss(id),
  };
}

export { useToast, toast };
