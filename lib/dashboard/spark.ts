// Tiny helpers for the dashboard stat-card sparklines. Pure functions that
// bucket a list of dated records into a fixed-length daily series and derive a
// week-over-week trend from it.

import { subDays } from "date-fns";

const DEFAULT_DAYS = 14;

/**
 * Bucket `items` into a `days`-long daily series (oldest → newest), summing
 * `getVal` for each item that falls on a given day. Records outside the window
 * (or with no date) are ignored.
 */
export function dailySeries<T>(
  items: T[],
  getDate: (t: T) => string | null | undefined,
  getVal: (t: T) => number = () => 1,
  days = DEFAULT_DAYS,
): number[] {
  const buckets: Record<string, number> = {};
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = subDays(new Date(), i).toISOString().slice(0, 10);
    keys.push(k);
    buckets[k] = 0;
  }
  for (const it of items) {
    const d = getDate(it);
    if (!d) continue;
    const k = String(d).slice(0, 10);
    if (k in buckets) buckets[k] += getVal(it);
  }
  return keys.map((k) => buckets[k]!);
}

/** % change of `last` vs `prev`. null when there's no prior baseline. */
export function trendPct(last: number, prev: number): number | null {
  if (prev <= 0) return last > 0 ? 100 : null;
  return Math.round(((last - prev) / prev) * 100);
}

/** Week-over-week trend from a daily series (second half vs first half). */
export function seriesTrend(series: number[]): number | null {
  const half = Math.floor(series.length / 2);
  const prev = series.slice(0, half).reduce((a, b) => a + b, 0);
  const last = series.slice(half).reduce((a, b) => a + b, 0);
  return trendPct(last, prev);
}
