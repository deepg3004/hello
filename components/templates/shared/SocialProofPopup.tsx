"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

import type { PopupPosition } from "@/lib/social-proof";

interface ProofEvent {
  buyer_name: string | null;
  buyer_city: string | null;
  product_name: string | null;
  amount: number | null;
  is_seed: boolean | null;
  created_at: string;
}

interface ApiBody {
  events?: ProofEvent[];
}

export interface SocialProofPopupProps {
  pageId: string;
  /** Seconds between popups. */
  delayBetweenSeconds?: number;
  /** Seconds each popup is on screen. */
  displayDurationSeconds?: number;
  /** Corner to dock from. */
  position?: PopupPosition;
  /** Hide entirely (preview / disabled by config). */
  disabled?: boolean;
}

/**
 * Recent-buyer popup. Mounts once on the public /p/[slug] page; quietly
 * no-ops in preview. Loops through the latest events, then re-fetches and
 * loops again after every full pass.
 */
export function SocialProofPopup({
  pageId,
  delayBetweenSeconds = 25,
  displayDurationSeconds = 7,
  position = "bottom-left",
  disabled,
}: SocialProofPopupProps) {
  const [events, setEvents] = useState<ProofEvent[]>([]);
  const [shown, setShown] = useState<ProofEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const queueIdxRef = useRef(0);

  // ── Fetch events. We re-fetch after each full pass through the queue ──
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/social-proof/${pageId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as ApiBody;
      if (Array.isArray(body.events)) {
        setEvents(body.events);
      }
    } catch {
      /* network noise — try again next loop */
    }
  }, [pageId]);

  useEffect(() => {
    if (disabled || dismissed) return;
    void loadEvents();
  }, [disabled, dismissed, loadEvents]);

  // ── Animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled || dismissed) return;
    if (events.length === 0) return;

    let cancelled = false;
    const showMs = Math.max(1000, displayDurationSeconds * 1000);
    const gapMs = Math.max(1000, delayBetweenSeconds * 1000);
    const timers: ReturnType<typeof setTimeout>[] = [];

    function step() {
      if (cancelled) return;
      // Show current
      const cur = events[queueIdxRef.current % events.length] ?? null;
      setShown(cur);
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setShown(null);
        }, showMs),
      );
      // Schedule next
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          queueIdxRef.current += 1;
          // After a full pass, refetch so we pick up new conversions.
          if (queueIdxRef.current % events.length === 0) {
            void loadEvents();
          }
          step();
        }, showMs + gapMs),
      );
    }

    // Initial gap before the very first popup so users get oriented.
    timers.push(setTimeout(step, gapMs));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [
    events,
    displayDurationSeconds,
    delayBetweenSeconds,
    disabled,
    dismissed,
    loadEvents,
  ]);

  // ── Render ────────────────────────────────────────────────────────────
  const visible = !disabled && !dismissed && !!shown;
  const positionClasses = useMemo(
    () => (position === "bottom-right" ? "right-4" : "left-4"),
    [position],
  );

  if (!visible || !shown) return null;

  const name = shown.buyer_name?.trim() || "Someone";
  const city = shown.buyer_city?.trim();
  const product = shown.product_name?.trim();
  const when = relativeTime(shown.created_at);

  return (
    <div
      className={`fixed bottom-4 z-40 max-w-xs animate-in slide-in-from-bottom-3 fade-in ${positionClasses}`}
    >
      <div className="relative rounded-xl border border-black/10 bg-white p-3 shadow-2xl ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="pr-4 text-xs text-zinc-700">
            <p>
              <span className="font-semibold">{name}</span>
              {city ? ` from ${city}` : ""}
              {product ? (
                <>
                  {" "}
                  just purchased{" "}
                  <span className="font-semibold">{product}</span>
                </>
              ) : (
                " just made a purchase"
              )}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
              {when}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "just now";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
