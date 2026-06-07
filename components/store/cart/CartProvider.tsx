"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartItem {
  product_id: string;
  variant_id?: string | null;
  variant_name?: string | null;
  name: string;
  price: number; // rupees
  image_url: string | null;
  slug: string;
  quantity: number;
}

/** A cart line is identified by (product, variant) so two variants of the same
 *  product are distinct lines. */
export function lineKey(it: { product_id: string; variant_id?: string | null }): string {
  return `${it.product_id}::${it.variant_id ?? ""}`;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number; // rupees
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  openCart: () => void;
  /** True when a page renders a fixed mobile buy bar at the bottom (product
   *  detail), so the floating cart pill lifts above it on small screens. */
  floatingBar: boolean;
  setFloatingBar: (v: boolean) => void;
  /** Seller account id, used to fetch publicly-listed promo codes. */
  sellerId: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Per-seller cart persisted in localStorage (one seller per cart, keyed by the
 *  store's username/subdomain). */
export function CartProvider({
  username,
  sellerId = null,
  children,
}: {
  username: string;
  sellerId?: string | null;
  children: React.ReactNode;
}) {
  const key = `invox_cart_${username}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [floatingBar, setFloatingBar] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, key, loaded]);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    const addQty = Math.max(1, Math.min(99, Math.floor(qty)));
    setItems((prev) => {
      const k = lineKey(item);
      const ex = prev.find((p) => lineKey(p) === k);
      if (ex) {
        return prev.map((p) =>
          lineKey(p) === k ? { ...p, quantity: Math.min(99, p.quantity + addQty) } : p,
        );
      }
      return [...prev, { ...item, quantity: addQty }];
    });
  }, []);

  const openCart = useCallback(() => setOpen(true), []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => lineKey(p) !== key)
        : prev.map((p) => (lineKey(p) === key ? { ...p, quantity: Math.min(99, qty) } : p)),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => lineKey(p) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, p) => n + p.quantity, 0);
    const subtotal = items.reduce((s, p) => s + p.price * p.quantity, 0);
    return { items, count, subtotal, add, setQty, remove, clear, isOpen, setOpen, openCart, floatingBar, setFloatingBar, sellerId };
  }, [items, add, setQty, remove, clear, isOpen, openCart, floatingBar, sellerId]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

/** Like useCart but returns null instead of throwing when there's no provider
 *  (e.g. the bottom nav renders on course/legal pages that have no cart). */
export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}
