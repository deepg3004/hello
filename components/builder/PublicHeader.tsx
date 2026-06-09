"use client";

// Public site header. On desktop it renders the seller's built header inline.
// On mobile it collapses into a hamburger that reveals the same header content
// (logo / menu / social / button) in a slide-down panel.

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { BlockRenderer } from "@/components/builder/BlockRenderer";
import type { BuilderDocument } from "@/lib/builder/types";

export function PublicHeader({ doc, siteId }: { doc: BuilderDocument; siteId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
      {/* Desktop: full header inline */}
      <div className="hidden md:block">
        <BlockRenderer doc={doc} siteId={siteId} />
      </div>

      {/* Mobile: a slim bar + hamburger that expands the full header */}
      <div className="md:hidden">
        <div className="flex items-center justify-end px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-md border border-black/10 p-2 text-zinc-700"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-black/5 px-2 pb-4">
            <BlockRenderer doc={doc} siteId={siteId} />
          </div>
        )}
      </div>
    </header>
  );
}
