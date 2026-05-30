"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

interface OtoCountdownBarProps {
  /** Total seconds for the OTO window. Defaults to 900 (15 min). */
  totalSeconds?: number;
  /** Optional label override. */
  label?: string;
}

/**
 * Sticky bottom-of-viewport countdown shown on the OTO page. Visible on
 * mobile (md:hidden); desktop uses the inline countdown in the offer card
 * instead, so we don't double up.
 */
export function OtoCountdownBar({
  totalSeconds = 900,
  label = "This offer expires in",
}: OtoCountdownBarProps) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const mmss = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  const pctLeft = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const lowTime = pctLeft <= 20;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-300 bg-amber-50 px-4 py-3 shadow-2xl md:hidden">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-amber-900">
          <Clock className="h-4 w-4" />
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-base font-bold tabular-nums",
            lowTime ? "text-rose-600" : "text-amber-900",
          )}
        >
          {mmss}
        </span>
      </div>
      {/* Progress bar — drains right-to-left as time runs out */}
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-amber-200">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            lowTime ? "bg-rose-500" : "bg-amber-500",
          )}
          style={{ width: `${pctLeft}%` }}
        />
      </div>
    </div>
  );
}
