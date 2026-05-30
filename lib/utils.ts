import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

export function platformCommissionPaise(amountPaise: number): number {
  const pct = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 5);
  return Math.round((amountPaise * pct) / 100);
}

// ── Date + string helpers used across the dashboard tables ─────────────

/**
 * "21 Apr 2026" — short locale-aware date for India.
 * Pass an ISO string (Supabase timestamptz columns serialise to this).
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * "21 Apr, 14:30" — same locale, drops year, adds time. Used in tables
 * where the year column would be repetitive and the recent-activity feel
 * matters more than the calendar reference.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Trim strings that would otherwise wrap awkwardly in tight table cells
 * (subdomain labels, product titles, slugs). Appends a single ellipsis
 * character so the truncation is obvious.
 */
export function truncate(str: string, n = 28): string {
  return str.length > n ? str.slice(0, n) + "…" : str;
}
