"use client";

import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";

import { useCart, type CartItem } from "./CartProvider";

/** Add-to-cart control for a catalog product card. Stops the parent card link
 *  from navigating when clicked. */
export function AddToCartButton({
  product,
  className,
}: {
  product: Omit<CartItem, "quantity">;
  className?: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        add(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700"
      }
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" /> Added
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5" /> Add
        </>
      )}
    </button>
  );
}
