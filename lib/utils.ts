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
