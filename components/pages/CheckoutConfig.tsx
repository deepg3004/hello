"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { CheckoutConfig } from "@/lib/checkout-config";

/**
 * Page-level checkout configuration provided by the public page (and the
 * preview) and consumed by `CheckoutForm`. This lets a page-wide setting like
 * "Custom price (pay what you like)" flow into the checkout of ANY payment
 * template without each template having to thread the props through.
 *
 * The config-builder (`checkoutConfigFromValues`) + the `CheckoutConfig` type
 * live in `@/lib/checkout-config` (a non-client module) so server components
 * can call the builder; this file only holds the React context plumbing.
 */
const Ctx = createContext<CheckoutConfig | null>(null);

export function useCheckoutConfig(): CheckoutConfig | null {
  return useContext(Ctx);
}

export function CheckoutConfigProvider({
  config,
  children,
}: {
  config: CheckoutConfig | null;
  children: ReactNode;
}) {
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}
