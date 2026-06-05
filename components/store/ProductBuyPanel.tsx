"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingCart, Zap } from "lucide-react";

import { formatINR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/components/store/cart/CartProvider";
import type { VariantOption } from "@/components/store/cart/AddToCartButton";

export interface BuyPanelProduct {
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  slug: string;
  stock: number | null;
  variants: { id: string; name: string; price: number; stock: number | null }[];
}

/** Detail-page purchase controls: variant choice, quantity, add-to-cart, buy-now. */
export function ProductBuyPanel({ product }: { product: BuyPanelProduct }) {
  const { add, openCart } = useCart();
  const { toast } = useToast();
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
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold">{formatINR(Math.round(price * 100))}</span>
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
                    "rounded-lg border px-3 py-2 text-sm transition " +
                    (out
                      ? "cursor-not-allowed border-dashed text-muted-foreground line-through"
                      : v.id === variantId
                        ? "border-primary bg-primary/5 font-semibold text-primary"
                        : "hover:border-primary")
                  }
                >
                  {v.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {formatINR(Math.round(v.price * 100))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-lg border">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-muted-foreground hover:text-foreground"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            className="px-3 py-2 text-muted-foreground hover:text-foreground"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {stock != null && stock > 0 && stock <= 5 && (
          <span className="text-sm font-medium text-rose-600">Only {stock} left</span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onAdd}
          disabled={soldOut}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent"
        >
          {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {soldOut ? "Sold out" : added ? "Added" : "Add to cart"}
        </button>
        <button
          onClick={onBuyNow}
          disabled={soldOut}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Zap className="h-4 w-4" /> Buy now
        </button>
      </div>
    </div>
  );
}
