"use client";

import { Sparkles } from "lucide-react";

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

  return (
    <label
      htmlFor="order-bump-checkbox"
      className={
        "block cursor-pointer rounded-md border-2 border-dashed p-3 transition " +
        (checked
          ? "border-amber-500 bg-amber-50"
          : "border-amber-300 bg-amber-50/60 hover:bg-amber-50")
      }
    >
      <div className="flex items-start gap-3">
        <input
          id="order-bump-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-amber-600"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Yes! Add <span className="underline">{title}</span> to my order for just{" "}
              <span className="font-mono">₹{price.toLocaleString("en-IN")}</span>
            </span>
          </div>
          {description && (
            <p className="mt-1 text-xs text-amber-800">{description}</p>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {config.image_url && (
          <img
            src={config.image_url}
            alt={title}
            className="h-14 w-14 shrink-0 rounded-md border border-amber-300 object-cover"
          />
        )}
      </div>
    </label>
  );
}
