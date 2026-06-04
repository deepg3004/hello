"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live countdown to a target datetime. No dependencies. */
export function CountdownBlock({ to, accent }: { to: string; accent: string }) {
  const target = new Date(to).getTime();
  const [left, setLeft] = useState<number>(() =>
    Number.isFinite(target) ? target - Date.now() : 0,
  );

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const t = setInterval(() => setLeft(target - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (!Number.isFinite(target)) return null;
  const p = parts(left);
  const Cell = ({ v, label }: { v: number; label: string }) => (
    <div className="flex flex-col items-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold tabular-nums sm:h-20 sm:w-20 sm:text-3xl"
        style={{ background: `${accent}22`, color: accent }}
      >
        {String(v).padStart(2, "0")}
      </span>
      <span className="mt-1 text-xs uppercase tracking-wide text-[color:var(--s-fg-dim)]">
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex justify-center gap-3 sm:gap-4">
      <Cell v={p.d} label="Days" />
      <Cell v={p.h} label="Hrs" />
      <Cell v={p.m} label="Min" />
      <Cell v={p.s} label="Sec" />
    </div>
  );
}
