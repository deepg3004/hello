"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, ShoppingCart, User } from "lucide-react";

import { useCartOptional } from "@/components/store/cart/CartProvider";

/** Strip an internal `/seller-host/<username>` rewrite prefix so active-state
 *  matching works whether usePathname returns the clean or rewritten path. */
function cleanPath(p: string): string {
  const m = p.match(/^\/seller-host\/[^/]+(\/.*)?$/);
  return m ? m[1] || "/" : p;
}

/** Mobile app-style bottom tab bar (Home · Store · Cart · My Account). Shown on
 *  phones only (md:hidden); sits above every other fixed bar via z-50. */
export function StorefrontBottomNav() {
  const pathname = usePathname() || "/";
  const path = cleanPath(pathname);
  const cart = useCartOptional();
  const count = cart?.count ?? 0;

  const isHome = path === "/";
  const isStore = path === "/store" || path.startsWith("/store/");
  const isAccount = path.startsWith("/account");

  const itemBase =
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition";

  return (
    <nav
      className="sf-band sf-border fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t shadow-[0_-4px_24px_rgba(0,0,0,0.18)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Storefront"
    >
      <Link href="/" className={itemBase} style={{ color: isHome ? "var(--sf-accent)" : "var(--sf-muted)" }}>
        <Home className="h-5 w-5" />
        Home
      </Link>
      <Link href="/store" className={itemBase} style={{ color: isStore ? "var(--sf-accent)" : "var(--sf-muted)" }}>
        <Store className="h-5 w-5" />
        Store
      </Link>
      {cart ? (
        <button type="button" onClick={cart.openCart} className={itemBase} style={{ color: "var(--sf-muted)" }}>
          <span className="relative">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="sf-accent-bg absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none">
                {count}
              </span>
            )}
          </span>
          Cart
        </button>
      ) : (
        <Link href="/store" className={itemBase} style={{ color: "var(--sf-muted)" }}>
          <ShoppingCart className="h-5 w-5" />
          Cart
        </Link>
      )}
      <Link href="/account" className={itemBase} style={{ color: isAccount ? "var(--sf-accent)" : "var(--sf-muted)" }}>
        <User className="h-5 w-5" />
        Account
      </Link>
    </nav>
  );
}
