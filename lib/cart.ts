// Server-side cart validation. A cart is a list of {product_id, quantity}; we
// re-resolve every product from the DB (never trust client prices), enforce the
// hard constraints — all items must be CATALOG products (is_catalog), ACTIVE, on
// a PUBLISHED page, and from ONE seller (one Razorpay order = one seller's
// gateway) — and compute the authoritative subtotal in paise.

import { createAdminClient } from "@/lib/supabase/admin";

export interface CartItemInput {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
}

export interface CartLine {
  product_id: string;
  variant_id: string | null;
  variant_name: string | null;
  name: string;
  unit_price_paise: number;
  quantity: number;
  line_paise: number;
  requires_shipping: boolean;
}

export interface ValidatedCart {
  sellerId: string;
  lines: CartLine[];
  subtotalPaise: number;
  requiresShipping: boolean;
}

export type CartValidation =
  | { ok: true; cart: ValidatedCart }
  | { ok: false; status: number; error: string };

interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  price: number;
  active: boolean;
  is_catalog: boolean;
  requires_shipping: boolean | null;
  stock: number | null;
  pages?: { status: string } | { status: string }[] | null;
}

export async function validateCart(
  items: CartItemInput[],
): Promise<CartValidation> {
  const clean = (items ?? [])
    .filter((i) => i && typeof i.product_id === "string")
    .map((i) => ({
      product_id: i.product_id,
      variant_id: typeof i.variant_id === "string" ? i.variant_id : null,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(i.quantity) || 1))),
    }));
  if (clean.length === 0) return { ok: false, status: 400, error: "Your cart is empty" };

  const admin = createAdminClient();
  const ids = Array.from(new Set(clean.map((i) => i.product_id)));
  const { data: products } = await admin
    .from("products")
    .select(
      "id, user_id, name, price, active, is_catalog, requires_shipping, stock, pages!products_page_id_fkey(status)",
    )
    .in("id", ids);
  const byId = new Map(((products ?? []) as ProductRow[]).map((p) => [p.id, p]));

  // Variants for these products (active only).
  const { data: variantsRaw } = await admin
    .from("product_variants")
    .select("id, product_id, name, price, stock, active")
    .in("product_id", ids)
    .eq("active", true);
  type VRow = { id: string; product_id: string; name: string; price: number; stock: number | null; active: boolean };
  const variantById = new Map<string, VRow>();
  const hasVariants = new Set<string>();
  for (const v of (variantsRaw ?? []) as VRow[]) {
    variantById.set(v.id, v);
    hasVariants.add(v.product_id);
  }

  const lines: CartLine[] = [];
  let sellerId: string | null = null;
  let subtotalPaise = 0;
  let requiresShipping = false;

  for (const item of clean) {
    const p = byId.get(item.product_id);
    if (!p || !p.active || !p.is_catalog) {
      return { ok: false, status: 400, error: "An item in your cart is no longer available." };
    }
    const page = Array.isArray(p.pages) ? p.pages[0] : p.pages;
    if (!page || page.status !== "published") {
      return { ok: false, status: 400, error: "An item in your cart is no longer available." };
    }
    if (sellerId === null) sellerId = p.user_id;
    else if (sellerId !== p.user_id) {
      return {
        ok: false,
        status: 400,
        error: "Your cart has items from different stores — check out one store at a time.",
      };
    }
    // Price + stock come from the chosen VARIANT when the product has variants.
    let unit: number;
    let stock: number | null;
    let lineName = p.name;
    let variantId: string | null = null;
    let variantName: string | null = null;
    if (hasVariants.has(p.id)) {
      const v = item.variant_id ? variantById.get(item.variant_id) : null;
      if (!v || v.product_id !== p.id) {
        return { ok: false, status: 400, error: `Pick an option for "${p.name}".` };
      }
      unit = Math.round(Number(v.price ?? 0) * 100);
      stock = v.stock;
      variantId = v.id;
      variantName = v.name;
      lineName = `${p.name} — ${v.name}`;
    } else {
      unit = Math.round(Number(p.price ?? 0) * 100);
      stock = p.stock;
    }
    if (stock != null && stock < item.quantity) {
      return { ok: false, status: 409, error: `"${lineName}" doesn't have enough stock.` };
    }
    if (unit <= 0) return { ok: false, status: 400, error: "An item has no price." };
    const linePaise = unit * item.quantity;
    lines.push({
      product_id: p.id,
      variant_id: variantId,
      variant_name: variantName,
      name: lineName,
      unit_price_paise: unit,
      quantity: item.quantity,
      line_paise: linePaise,
      requires_shipping: !!p.requires_shipping,
    });
    subtotalPaise += linePaise;
    if (p.requires_shipping) requiresShipping = true;
  }

  if (!sellerId) return { ok: false, status: 400, error: "Your cart is empty" };
  return { ok: true, cart: { sellerId, lines, subtotalPaise, requiresShipping } };
}
