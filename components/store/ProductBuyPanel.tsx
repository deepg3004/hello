"use client";

import { useEffect, useState } from "react";
import { Check, Minus, Plus, ShoppingCart, Zap } from "lucide-react";

import { formatINR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/components/store/cart/CartProvider";
import type { VariantOption } from "@/components/store/cart/AddToCartButton";

export interface BuyPanelProduct {
  product_id: string;
  name: string;
  price: number;
  /** Regular ("was") price for strike-through display, when on offer. */
  original_price: number | null;
  image_url: string | null;
  slug: string;
  stock: number | null;
  variants: { id: string; name: string; price: number; stock: number | null }[];
}

/** Detail-page purchase controls: variant choice, quantity, add-to-cart, buy-now.
 *  `navHidden` drops the sticky mobile bar to the screen bottom when the
 *  storefront bottom nav isn't rendered (the product page hides it). */
export function ProductBuyPanel({
  product,
  navHidden = false,
}: {
  product: BuyPanelProduct;
  navHidden?: boolean;
}) {
  const { add, openCart, setFloatingBar } = useCart();
  const { toast } = useToast();

  // Tell the cart to lift its floating pill above our mobile buy bar.
  useEffect(() => {
    setFloatingBar(true);
    return () => setFloatingBar(false);
  }, [setFloatingBar]);
  const hasVariants = product.variants.length > 0;
  const [variantId, setVariantId] = useState<string | null>(
    hasVariants ? product.variants[0].id : null,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = hasVariants ? product.variants.find((v) => v.id === variantId) ?? null : null;
  const price = variant ? variant.price : product.price;
  const stock = variant ? variant.stock : product.stock;
  const soldOut = stock != null && stock <= 0;
  const maxQty = stock != null ? Math.max(1, stock) : 99;

  // "Was" price for the strike-through / save badge (product-level offer).
  const original = product.original_price;
  const onOffer = original != null && original > price;
  const offPct = onOffer ? Math.round(((original - price) / original) * 100) : 0;

  function toCart(): VariantOption | null | false {
    if (soldOut) return false;
    add(
      {
        product_id: product.product_id,
        name: product.name,
        price,
        image_url: product.image_url,
        slug: product.slug,
        variant_id: variant?.id ?? null,
        variant_name: variant?.name ?? null,
      },
      qty,
    );
    return variant ? { id: variant.id, name: variant.name, price: variant.price } : null;
  }

  function onAdd() {
    if (toCart() === false) return;
    setAdded(true);
    toast({ title: "Added to cart", description: `${product.name}${variant ? ` — ${variant.name}` : ""} × ${qty}` });
    setTimeout(() => setAdded(false), 1400);
  }

  function onBuyNow() {
    if (toCart() === false) return;
    openCart();
  }

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold">{formatINR(Math.round(price * 100))}</span>
        {onOffer && (
          <>
            <span className="text-base sf-muted line-through">{formatINR(Math.round(original * 100))}</span>
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-500">
              {offPct}% off
            </span>
          </>
        )}
      </div>

      {hasVariants && (
        <div>
          <p className="mb-2 text-sm font-medium">Options</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const out = v.stock != null && v.stock <= 0;
              return (
                <button
                  key={v.id}
                  disabled={out}
                  onClick={() => setVariantId(v.id)}
                  className={
                    "px-3 py-2 text-sm transition " +
                    (out
                      ? "sf-chip cursor-not-allowed opacity-50 line-through"
                      : v.id === variantId
                        ? "sf-chip-active font-semibold"
                        : "sf-chip hover:opacity-90")
                  }
                >
                  {v.name}
                  <span className="ml-1.5 text-xs opacity-80">{formatINR(Math.round(v.price * 100))}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="sf-border flex items-center rounded-full border">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="sf-muted px-3 py-2 hover:opacity-80" aria-label="Decrease quantity">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="sf-muted px-3 py-2 hover:opacity-80" aria-label="Increase quantity">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {stock != null && stock > 0 && stock <= 5 && (
          <span className="text-sm font-medium text-rose-500">Only {stock} left</span>
        )}
      </div>

      {/* Inline buttons on tablet/desktop; on mobile the fixed bottom bar takes over. */}
      <div className="hidden gap-2 md:flex md:flex-col lg:flex-row">
        <button
          onClick={onAdd}
          disabled={soldOut}
          className="sf-btn-outline inline-flex flex-1 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {soldOut ? "Sold out" : added ? "Added" : "Add to cart"}
        </button>
        <button
          onClick={onBuyNow}
          disabled={soldOut}
          className="sf-btn inline-flex flex-1 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Zap className="h-4 w-4" /> Buy now
        </button>
      </div>
    </div>

      {/* Sticky mobile buy bar — sits above the bottom nav, or at the screen
          edge when the nav is hidden (product page). */}
      <div
        className={`sf-band sf-border fixed inset-x-0 ${navHidden ? "bottom-0" : "bottom-16"} z-40 border-t px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.18)] md:hidden`}
        style={navHidden ? { paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" } : undefined}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{formatINR(Math.round(price * 100))}</span>
            {onOffer && (
              <>
                <span className="text-sm sf-muted line-through">{formatINR(Math.round(original * 100))}</span>
                <span className="text-xs font-semibold text-rose-500">{offPct}% off</span>
              </>
            )}
          </span>
          {stock != null && stock > 0 && stock <= 5 && (
            <span className="text-xs font-medium text-rose-500">Only {stock} left</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            disabled={soldOut}
            className="sf-btn-outline inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {soldOut ? "Sold out" : added ? "Added" : "Add to cart"}
          </button>
          <button
            onClick={onBuyNow}
            disabled={soldOut}
            className="sf-btn inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap className="h-4 w-4" /> Buy now
          </button>
        </div>
      </div>
    </>
  );
}
