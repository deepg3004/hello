"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import type { ChromeConfig } from "@/lib/storefront-theme";

/** Themed storefront nav bar — logo/name, menu links, optional CTA, and a
 *  mobile hamburger. Reads theme tokens from the surrounding .sf-root. */
export function StorefrontHeader({
  header,
  brandName,
  logo,
}: {
  header: ChromeConfig["header"];
  brandName: string;
  logo: string;
}) {
  const [open, setOpen] = useState(false);
  const menu = header.menu;

  return (
    <header
      className={
        "sf-band sf-border z-30 border-b " +
        (header.sticky ? "sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-[var(--sf-bg2)]/85" : "")
      }
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={brandName} className="h-8 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="sf-display text-lg font-bold">{brandName}</span>
          )}
        </a>

        {/* Desktop menu */}
        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {menu.map((m, i) => (
            <a key={i} href={m.url} className="sf-muted text-sm font-medium transition hover:opacity-80">
              {m.label}
            </a>
          ))}
          {header.ctaLabel && header.ctaUrl && (
            <a href={header.ctaUrl} className="sf-btn px-4 py-2 text-sm font-semibold">
              {header.ctaLabel}
            </a>
          )}
        </nav>

        {/* Mobile toggle */}
        <button onClick={() => setOpen((v) => !v)} className="sf-btn-outline ml-auto inline-flex h-9 w-9 items-center justify-center md:hidden" aria-label="Menu">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sf-border border-t px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {menu.map((m, i) => (
              <a key={i} href={m.url} onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm font-medium hover:bg-[var(--sf-surface)]">
                {m.label}
              </a>
            ))}
            {header.ctaLabel && header.ctaUrl && (
              <a href={header.ctaUrl} className="sf-btn mt-1 px-4 py-2 text-center text-sm font-semibold">
                {header.ctaLabel}
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
