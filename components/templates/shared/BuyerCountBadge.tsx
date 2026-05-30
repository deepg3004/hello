"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import type { CountType } from "@/lib/social-proof";

interface ApiBody {
  count?: { total?: number; today?: number; week?: number };
}

export interface BuyerCountBadgeProps {
  pageId: string;
  countType?: CountType;
  labelText?: string;
  disabled?: boolean;
}

const REFRESH_MS = 60_000;

export function BuyerCountBadge({
  pageId,
  countType = "total",
  labelText = "people bought this",
  disabled,
}: BuyerCountBadgeProps) {
  const [count, setCount] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const lastCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/social-proof/${pageId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as ApiBody;
        const next =
          countType === "today"
            ? Number(body.count?.today ?? 0)
            : countType === "week"
              ? Number(body.count?.week ?? 0)
              : Number(body.count?.total ?? 0);
        if (cancelled) return;
        if (lastCountRef.current !== null && next !== lastCountRef.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
        lastCountRef.current = next;
        setCount(next);
      } catch {
        /* network noise */
      }
    }
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pageId, countType, disabled]);

  if (disabled || count == null || count <= 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-30 -translate-x-1/2">
      <div
        className={
          "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm transition-transform duration-300 " +
          (pulse ? "scale-105" : "scale-100")
        }
      >
        <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
        <span>
          <strong>{count.toLocaleString("en-IN")}</strong> {labelText}
        </span>
      </div>
    </div>
  );
}
