"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, User, X } from "lucide-react";

import type { ChromeConfig } from "@/lib/storefront-theme";

/** Themed storefront nav bar — logo/name (links to logoUrl with click-source
 *  tracking), menu links, optional CTA, buyer Login/Sign-up, mobile hamburger. */
export function StorefrontHeader({
  header,
  brandName,
  logo,
  buyerLoggedIn = false,
}: {
  header: ChromeConfig["header"];
  brandName: string;
  logo: string;
  /** When the buyer has an active session, show "My Account" instead of the
   *  Login / Sign-up buttons. */
  buyerLoggedIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname() || "/";
  const menu = header.menu;

  // Logo links to the configured page, carrying the source path so the landing
  // page (and analytics) can see where the click came from.
  const sep = header.logoUrl.includes("?") ? "&" : "?";
  const logoHref = `${header.logoUrl}${sep}from=${encodeURIComponent(path)}`;
  const authHref = (mode: string) => `/account?next=${encodeURIComponent(path)}&mode=${mode}`;

  return (
    <header
      className={
        "sf-band sf-border z-30 border-b " +
        (header.sticky ? "sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-[var(--sf-bg2)]/85" : "")
      }
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <a href={logoHref} className="flex items-center gap-2" aria-label="Home">
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
          {header.showAuth &&
            (buyerLoggedIn ? (
              <a
                href="/account"
                className="sf-btn-outline inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition hover:opacity-80"
              >
                <User className="h-4 w-4" /> My Account
              </a>
            ) : (
              <span className="flex items-center gap-2">
                <a href={authHref("login")} className="sf-btn-outline inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition hover:opacity-80">
                  <User className="h-4 w-4" /> Login
                </a>
                <a href={authHref("signup")} className="sf-btn px-3.5 py-2 text-sm font-semibold">
                  Sign up
                </a>
              </span>
            ))}
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
            {header.showAuth &&
              (buyerLoggedIn ? (
                <a
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="sf-btn-outline mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-center text-sm font-semibold"
                >
                  <User className="h-4 w-4" /> My Account
                </a>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a href={authHref("login")} className="sf-btn-outline px-3 py-2 text-center text-sm font-semibold">
                    Login
                  </a>
                  <a href={authHref("signup")} className="sf-btn px-3 py-2 text-center text-sm font-semibold">
                    Sign up
                  </a>
                </div>
              ))}
          </nav>
        </div>
      )}
    </header>
  );
}
