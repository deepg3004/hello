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
  name: string;
  price: number; // rupees
  image_url: string | null;
  slug: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number; // rupees
  add: (item: Omit<CartItem, "quantity">) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Per-seller cart persisted in localStorage (one seller per cart, keyed by the
 *  store's username/subdomain). */
export function CartProvider({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const key = `invox_cart_${username}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const add = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const ex = prev.find((p) => p.product_id === item.product_id);
      if (ex) {
        return prev.map((p) =>
          p.product_id === item.product_id ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => p.product_id !== productId)
        : prev.map((p) =>
            p.product_id === productId ? { ...p, quantity: Math.min(99, qty) } : p,
          ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((p) => p.product_id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, p) => n + p.quantity, 0);
    const subtotal = items.reduce((s, p) => s + p.price * p.quantity, 0);
    return { items, count, subtotal, add, setQty, remove, clear };
  }, [items, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
