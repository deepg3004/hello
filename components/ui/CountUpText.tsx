"use client";

import { useMemo } from "react";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

// Splits a display string into prefix + number + suffix, e.g.
//   "₹1.2L" → { prefix:"₹", n:1.2, suffix:"L", decimals:1 }
//   "₹1,80,000" → { prefix:"₹", n:180000, suffix:"", hasComma:true }
//   "340" → { n:340 }   "8%" → { n:8, suffix:"%" }
const RE = /^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/;

function parse(s: string) {
  const m = RE.exec(s.trim());
  if (!m) return null;
  const [, prefix, numStr, suffix] = m;
  const n = Number(numStr!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const dot = numStr!.indexOf(".");
  return {
    prefix: prefix ?? "",
    suffix: suffix ?? "",
    n,
    decimals: dot >= 0 ? numStr!.length - dot - 1 : 0,
    hasComma: numStr!.includes(","),
  };
}

/**
 * Renders a metric string with its numeric part counting up on mount. Falls
 * back to the raw text when there's no parseable number (e.g. "—", "Active").
 */
export function CountUpText({
  text,
  duration = 1000,
}: {
  text: string;
  duration?: number;
}) {
  const p = useMemo(() => parse(text), [text]);
  if (!p) return <>{text}</>;
  const fmt = (v: number) => {
    const body = p.hasComma
      ? Math.round(v).toLocaleString("en-IN")
      : v.toFixed(p.decimals);
    return `${p.prefix}${body}${p.suffix}`;
  };
  return <AnimatedNumber value={p.n} format={fmt} duration={duration} />;
}
