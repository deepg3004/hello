"use client";

// Buy / Product widget. Reuses the platform's EXISTING, proven /p/<slug>
// checkout (Razorpay + seller gateway) — the seller points this at one of their
// payment pages, so there's zero new money-path code or risk. Shows product +
// price + a Buy button.

import { ShoppingCart } from "lucide-react";

import { useBuilderContext } from "@/components/builder/BuilderContext";

const s = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);

export function BuyWidget({ content }: { content: Record<string, unknown> }) {
  const { preview } = useBuilderContext();
  const slug = s(content.slug).trim();
  const color = s(content.color, "#16a34a");
  const href = slug ? `/p/${slug}` : "#";

  return (
    <div className="rounded-2xl border border-current/10 bg-current/5 p-6 text-center">
      <p className="text-lg font-semibold">{s(content.name, "Your product")}</p>
      {s(content.price) && <p className="mt-1 text-3xl font-extrabold">{s(content.price)}</p>}
      <a
        href={href}
        // In the editor preview, don't navigate (it's just a mock).
        onClick={(e) => preview && slug && e.preventDefault()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: color }}
      >
        <ShoppingCart className="h-4 w-4" />
        {s(content.label, "Buy now")}
      </a>
      {!slug && (
        <p className="mt-2 text-xs text-current/50">
          Set a checkout page slug in the widget settings (your /p/&lt;slug&gt; payment page).
        </p>
      )}
    </div>
  );
}
