"use client";

import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/utils";
import { trackEvent } from "@/lib/tracking/events";
import { useCart, type CartItem } from "./CartProvider";

export interface VariantOption {
  id: string;
  name: string;
  price: number; // rupees
}

/** Add-to-cart control for a catalog product card. If the product has variants,
 *  it opens a picker first. Stops the parent card link from navigating. */
export function AddToCartButton({
  product,
  variants,
  className,
}: {
  product: Omit<CartItem, "quantity">;
  variants?: VariantOption[];
  className?: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [picking, setPicking] = useState(false);

  const cls =
    className ??
    "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700";

  function doAdd(v?: VariantOption) {
    add({
      ...product,
      variant_id: v?.id ?? null,
      variant_name: v?.name ?? null,
      price: v ? v.price : product.price,
    });
    // First-party AddToCart event (seller id from window.__INVOX_SELLER__,
    // set by the storefront-host TrackingProvider).
    trackEvent("AddToCart", {
      pageType: "storefront",
      productId: product.product_id,
      value: v ? v.price : product.price,
    });
    setPicking(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  const hasVariants = !!variants && variants.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasVariants) setPicking(true);
          else doAdd();
        }}
        className={cls}
      >
        {added ? (
          <>
            <Check className="h-3.5 w-3.5" /> Added
          </>
        ) : hasVariants ? (
          <>
            <ShoppingCart className="h-3.5 w-3.5" /> Options
          </>
        ) : (
          <>
            <ShoppingCart className="h-3.5 w-3.5" /> Add
          </>
        )}
      </button>

      {hasVariants && (
        <Dialog open={picking} onOpenChange={setPicking}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>{product.name} — choose an option</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              {variants!.map((v) => (
                <button
                  key={v.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    doAdd(v);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:border-primary hover:bg-muted"
                >
                  <span>{v.name}</span>
                  <span className="font-semibold">{formatINR(Math.round(v.price * 100))}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
