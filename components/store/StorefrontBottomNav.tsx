"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import { useCartOptional } from "@/components/store/cart/CartProvider";
import { NAV_ICON_MAP } from "@/components/store/navIcons";
import { defaultBottomNav, type ChromeConfig } from "@/lib/storefront-theme";
import { withStorefrontBase } from "@/lib/storefront-base";

const ICONS = NAV_ICON_MAP;

/** Strip an internal `/seller-host/<username>` rewrite prefix so active-state
 *  matching works whether usePathname returns the clean or rewritten path. */
function cleanPath(p: string): string {
  const m = p.match(/^\/seller-host\/[^/]+(\/.*)?$/);
  return m ? m[1] || "/" : p;
}

function isActive(path: string, url: string): boolean {
  if (!url || url === "#") return false;
  if (url === "/") return path === "/";
  return path === url || path.startsWith(url + "/");
}

/** Mobile app-style bottom tab bar. Items + icons + links + visibility are
 *  seller-configured via chrome.bottomNav; shown on phones only (md:hidden). */
export function StorefrontBottomNav({
  nav,
  basePath = "",
}: {
  nav?: ChromeConfig["bottomNav"];
  basePath?: string;
}) {
  const pathname = usePathname() || "/";
  const path = cleanPath(pathname);
  const cart = useCartOptional();
  const count = cart?.count ?? 0;

  const cfg = nav ?? defaultBottomNav();
  if (!cfg.enabled) return null;
  const items = cfg.items.filter((i) => i.visible);
  if (items.length === 0) return null;

  const itemBase =
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition";

  return (
    <nav
      className="sf-band sf-border fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t shadow-[0_-4px_24px_rgba(0,0,0,0.18)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Storefront"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutGrid;

        // Cart tab: open the drawer + show a count badge when a cart exists;
        // on pages without a cart (course/legal), fall back to the store.
        if (item.type === "cart") {
          const badge = count > 0 && (
            <span className="sf-accent-bg absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none">
              {count}
            </span>
          );
          return cart ? (
            <button key={item.key} type="button" onClick={cart.openCart} className={itemBase} style={{ color: "var(--sf-muted)" }}>
              <span className="relative">
                <Icon className="h-5 w-5" />
                {badge}
              </span>
              {item.label}
            </button>
          ) : (
            <Link key={item.key} href={withStorefrontBase(basePath, "/store")} className={itemBase} style={{ color: "var(--sf-muted)" }}>
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        }

        const active = isActive(path, item.url);
        return (
          <Link
            key={item.key}
            href={withStorefrontBase(basePath, item.url || "/")}
            className={itemBase}
            style={{ color: active ? "var(--sf-accent)" : "var(--sf-muted)" }}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
