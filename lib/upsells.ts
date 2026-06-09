// Shared types for order bump + OTO configurations stored on
// pages.page_config.{order_bump, oto_config}.

export interface OrderBumpConfig {
  enabled?: boolean;
  product_id?: string;
  /** Override price (defaults to the product's price). */
  price?: number;
  /** Optional "was" price for a strike-through anchor (must exceed `price`). */
  original_price?: number;
  title?: string;       // headline of the bump row
  description?: string;
  image_url?: string;
}

export interface OtoConfig {
  enabled?: boolean;
  product_id?: string;
  price?: number;
  headline?: string;
  description?: string;
  image_url?: string;
  cta_text?: string;
  decline_text?: string;
}

export const ORDER_BUMP_DEFAULTS: Required<
  Pick<OrderBumpConfig, "title" | "description">
> = {
  title: "Add to your order",
  description: "A perfect companion at a special checkout-only price.",
};

export const OTO_DEFAULTS: Required<
  Pick<OtoConfig, "headline" | "description" | "cta_text" | "decline_text">
> = {
  headline: "Wait! One-time offer.",
  description:
    "Add this exclusive upgrade to your purchase. You'll never see this offer again.",
  cta_text: "Yes, I want this!",
  decline_text: "No thanks, I don't want this",
};

export function isBumpReady(cfg?: OrderBumpConfig | null): cfg is OrderBumpConfig {
  if (!cfg?.enabled) return false;
  if (!cfg.product_id) return false;
  return true;
}

export function isOtoReady(cfg?: OtoConfig | null): cfg is OtoConfig {
  if (!cfg?.enabled) return false;
  if (!cfg.product_id) return false;
  return true;
}
