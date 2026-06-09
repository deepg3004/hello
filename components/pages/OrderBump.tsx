"use client";

import { Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OrderBumpConfig } from "@/lib/upsells";
import { ORDER_BUMP_DEFAULTS } from "@/lib/upsells";

interface OrderBumpProps {
  config: OrderBumpConfig;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function OrderBump({ config, checked, onChange }: OrderBumpProps) {
  const title = config.title ?? ORDER_BUMP_DEFAULTS.title;
  const description = config.description ?? ORDER_BUMP_DEFAULTS.description;
  const price = Number(config.price ?? 0);
  const wasPrice = Number(config.original_price ?? 0);
  const hasDiscount = wasPrice > price && price > 0;
  const pctOff = hasDiscount ? Math.round(((wasPrice - price) / wasPrice) * 100) : 0;

  // The checkbox state is mirrored to a custom-styled 24px square so we can
  // theme it consistently without relying on the browser default checkmark.
  return (
    <label
      htmlFor="order-bump-checkbox"
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200",
        checked
          ? "border-amber-400 bg-amber-50 shadow-sm"
          : "border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:bg-amber-50",
      )}
    >
      {/* Native checkbox kept for accessibility; visually hidden under the
          custom square. */}
      <input
        id="order-bump-checkbox"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150",
          checked
            ? "border-amber-500 bg-amber-500 text-white shadow-sm"
            : "border-amber-400 bg-white",
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-amber-900">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Add <span className="underline decoration-amber-400 decoration-2 underline-offset-2">{title}</span>
          </span>
          <span className="font-mono">
            {hasDiscount && (
              <span className="mr-1 font-normal text-amber-700/70 line-through">
                ₹{wasPrice.toLocaleString("en-IN")}
              </span>
            )}
            · ₹{price.toLocaleString("en-IN")}
          </span>
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
            {hasDiscount ? `Save ${pctOff}%` : `Just ₹${price.toLocaleString("en-IN")} more`}
          </span>
        </p>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
            {description}
          </p>
        )}
      </div>

      {/* Optional thumbnail on the right — kept from the legacy design so
          existing bumps with an image still render with it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {config.image_url && (
        <img
          src={config.image_url}
          alt={title}
          className="h-14 w-14 shrink-0 rounded-lg border border-amber-300 object-cover"
        />
      )}
    </label>
  );
}
