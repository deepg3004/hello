"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { Faq } from "@/lib/storefront-theme";

/** Seller-curated FAQ accordion (theme-aware). */
export function FaqSection({ items, title = "Frequently asked questions" }: { items: Faq[]; title?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <h2 className="sf-display mb-5 text-xl font-bold tracking-tight">{title}</h2>
      <div className="sf-card divide-y overflow-hidden" style={{ borderColor: "var(--sf-border)" }}>
        {items.map((f, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen((p) => (p === i ? null : i))}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
            >
              <ChevronDown className={"h-4 w-4 shrink-0 transition " + (open === i ? "" : "-rotate-90")} />
              <span className="flex-1">{f.q}</span>
            </button>
            {open === i && <p className="sf-muted whitespace-pre-line px-4 pb-4 pl-11 text-sm leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
