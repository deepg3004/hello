"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-fetches the server component tree every `seconds` so the channel
 * dashboard reflects join/leave + metric changes (updated by the webhook and
 * the 1-minute worker sync) without the seller hitting refresh. Pauses while
 * the tab is hidden to avoid needless work.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    };
    const id = setInterval(tick, Math.max(15, seconds) * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
