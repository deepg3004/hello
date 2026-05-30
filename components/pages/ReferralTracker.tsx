"use client";

import { useEffect } from "react";

interface Props {
  slug: string;
}

/**
 * Reads ?ref=<code> from the current URL, fires a beacon to record the
 * click + set the 30-day cookie server-side, then scrubs the query param
 * so the buyer's address bar stays clean.
 */
export function ReferralTracker({ slug }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const ref = sp.get("ref");
    if (!ref) return;
    try {
      const payload = JSON.stringify({ slug, ref });
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/affiliate/track-click", blob);
      } else {
        void fetch("/api/affiliate/track-click", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      /* network noise */
    }
    try {
      sp.delete("ref");
      const newQuery = sp.toString();
      const newUrl = `${window.location.pathname}${newQuery ? "?" + newQuery : ""}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    } catch {
      /* old browsers */
    }
  }, [slug]);

  return null;
}
