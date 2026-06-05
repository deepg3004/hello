"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { mdLite } from "@/lib/md-lite";
import type { Faq } from "@/lib/storefront-theme";

/** Seller-curated FAQ accordion (theme-aware, markdown-lite answers). */
export function FaqSection({
  items,
  title = "Frequently asked questions",
  align = "left",
}: {
  items: Faq[];
  title?: string;
  align?: "left" | "center";
}) {
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <h2 className={"sf-display mb-5 text-xl font-bold tracking-tight " + (align === "center" ? "text-center" : "")}>{title}</h2>
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
            {open === i && (
              <div className="sf-muted px-4 pb-4 pl-11 text-sm leading-relaxed [&_a]:text-[color:var(--sf-accent)]" dangerouslySetInnerHTML={{ __html: mdLite(f.a) }} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
