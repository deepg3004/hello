"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

interface ProofEvent {
  buyer_name: string | null;
  buyer_city: string | null;
  product_name: string | null;
  amount: number | null;
  is_seed: boolean | null;
  created_at: string;
}

interface SocialProofPopupProps {
  pageId: string;
  /** Poll interval in ms. Default 60s. */
  intervalMs?: number;
  /** Show duration per popup in ms. Default 5s. */
  showMs?: number;
  /** Skip rendering in preview mode. */
  disabled?: boolean;
}

export function SocialProofPopup({
  pageId,
  intervalMs = 60_000,
  showMs = 5_000,
  disabled,
}: SocialProofPopupProps) {
  const [events, setEvents] = useState<ProofEvent[]>([]);
  const [shown, setShown] = useState<ProofEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Pull events once on mount + every `intervalMs`.
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/social-proof/${pageId}`, { cache: "no-store" });
        const body = (await res.json()) as { events?: ProofEvent[] };
        if (!cancelled && Array.isArray(body.events)) setEvents(body.events);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pageId, intervalMs, disabled]);

  // Cycle through events: show one, wait, show next.
  useEffect(() => {
    if (disabled || events.length === 0 || dismissed) return;
    let idx = 0;
    function step() {
      setShown(events[idx % events.length] ?? null);
      const t1 = setTimeout(() => setShown(null), showMs);
      const t2 = setTimeout(() => {
        idx++;
        step();
      }, showMs + 8_000); // 8s gap between popups
      timers.push(t1, t2);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    step();
    return () => timers.forEach(clearTimeout);
  }, [events, showMs, disabled, dismissed]);

  if (disabled || dismissed || !shown) return null;

  const name = shown.buyer_name?.trim() || "Someone";
  const city = shown.buyer_city?.trim();
  const product = shown.product_name?.trim();
  const when = relativeTime(shown.created_at);

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-xs animate-in slide-in-from-bottom-3 fade-in">
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
          <div className="text-xs text-zinc-700">
            <p>
              <span className="font-semibold">{name}</span>
              {city ? ` from ${city}` : ""}
              {product ? <> just bought <span className="font-semibold">{product}</span></> : " just made a purchase"}
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
