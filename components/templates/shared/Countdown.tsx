"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  targetIso: string;
  label?: string;
  /** Class applied to the four boxes. Lets each template colour-match. */
  boxClassName?: string;
  /** Class applied to the digit. */
  digitClassName?: string;
  /** Class applied to the unit label. */
  unitClassName?: string;
}

interface Breakdown {
  d: number;
  h: number;
  m: number;
  s: number;
  expired: boolean;
}

function diff(targetMs: number): Breakdown {
  const ms = targetMs - Date.now();
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return { d, h, m, s, expired: false };
}

export function Countdown({
  targetIso,
  label,
  boxClassName = "bg-white/10 text-white",
  digitClassName = "text-2xl font-semibold tabular-nums",
  unitClassName = "text-[10px] uppercase tracking-wider opacity-70",
}: CountdownProps) {
  const targetMs = Date.parse(targetIso);
  const valid = Number.isFinite(targetMs);
  const [tick, setTick] = useState<Breakdown>(() =>
    valid ? diff(targetMs) : { d: 0, h: 0, m: 0, s: 0, expired: true },
  );

  useEffect(() => {
    if (!valid) return;
    const id = setInterval(() => setTick(diff(targetMs)), 1000);
    return () => clearInterval(id);
  }, [valid, targetMs]);

  if (!valid || tick.expired) return null;

  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="hidden text-sm font-medium opacity-90 sm:inline">{label}</span>
      )}
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ["Days", tick.d],
            ["Hrs", tick.h],
            ["Min", tick.m],
            ["Sec", tick.s],
          ] as const
        ).map(([unit, v]) => (
          <div
            key={unit}
            className={`flex min-w-[56px] flex-col items-center justify-center rounded-md px-2 py-1.5 ${boxClassName}`}
          >
            <span className={digitClassName}>
              {String(v).padStart(2, "0")}
            </span>
            <span className={unitClassName}>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
