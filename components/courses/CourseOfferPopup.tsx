"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export interface CourseOffer {
  title: string;
  text?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

/**
 * A dismissible promotional popup shown over the course player a few seconds
 * after load. Driven by the seller's storefront "promo" config. Shows once per
 * browser session per course (sessionStorage) so it isn't naggy.
 */
export function CourseOfferPopup({
  offer,
  courseKey,
}: {
  offer: CourseOffer;
  courseKey: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `invox_course_offer_${courseKey}`;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(key) === "1";
    } catch {
      /* private mode — just show it */
    }
    if (seen) return;
    const id = setTimeout(() => setOpen(true), 7000);
    return () => clearTimeout(id);
  }, [courseKey]);

  function dismiss() {
    setOpen(false);
    try {
      window.sessionStorage.setItem(`invox_course_offer_${courseKey}`, "1");
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm animate-fade-in-scale sm:bottom-6 sm:left-6 sm:mx-0">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Special offer
          </span>
        </div>
        <p className="mt-2 font-sora text-lg font-bold leading-snug">
          {offer.title}
        </p>
        {offer.text && (
          <p className="mt-1 text-sm text-muted-foreground">{offer.text}</p>
        )}
        {offer.ctaLabel && offer.ctaUrl && (
          <a
            href={offer.ctaUrl}
            onClick={dismiss}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {offer.ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
