"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import type { SiteNavPage } from "./SiteRenderer";

/** Responsive top nav for seller websites: inline links on desktop, a
 *  hamburger dropdown on mobile. */
export function SiteNav({
  seller,
  navPages,
  accent,
  currentSlug,
}: {
  seller: { name: string; avatar: string | null };
  navPages: SiteNavPage[];
  accent: string;
  currentSlug?: string;
}) {
  const [open, setOpen] = useState(false);

  function linkProps(p: SiteNavPage) {
    const isCurrent = p.isHome ? !currentSlug : currentSlug === p.slug;
    return {
      href: p.isHome ? "/" : `/${p.slug}`,
      style: isCurrent ? { color: accent } : undefined,
    };
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--s-border)] bg-[var(--s-surface)] backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-sora font-semibold text-[color:var(--s-fg)]"
        >
          {seller.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={seller.avatar}
              alt=""
              className="h-7 w-7 rounded-full object-cover ring-1 ring-[color:var(--s-border)]"
            />
          )}
          <span className="truncate">{seller.name}</span>
        </Link>

        {navPages.length > 0 && (
          <>
            {/* Desktop links */}
            <div className="hidden items-center gap-x-4 text-sm sm:flex">
              {navPages.map((p) => (
                <Link
                  key={p.slug}
                  {...linkProps(p)}
                  className="text-[color:var(--s-fg-muted)] transition hover:text-[color:var(--s-fg)]"
                >
                  {p.label}
                </Link>
              ))}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              className="text-[color:var(--s-fg)] sm:hidden"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </>
        )}
      </nav>

      {/* Mobile dropdown */}
      {open && navPages.length > 0 && (
        <div className="border-t border-[color:var(--s-border)] px-4 py-2 sm:hidden">
          {navPages.map((p) => (
            <Link
              key={p.slug}
              {...linkProps(p)}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-[color:var(--s-fg-muted)] hover:text-[color:var(--s-fg)]"
            >
              {p.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
