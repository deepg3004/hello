"use client";

import { useEffect } from "react";

import { trackPurchase } from "@/lib/tracking/events";

/**
 * Fires a server-confirmed first-party Purchase event once, on the order
 * success page (which only renders for a paid order). Independent of the Meta/
 * Google pixel Purchase fired in CheckoutForm — this feeds OUR analytics store.
 * De-duped per order via a window flag so a re-render can't double-count.
 */
export function PurchaseBeacon({
  sellerId,
  orderId,
  value,
  currency,
}: {
  sellerId: string;
  orderId: string;
  value: number;
  currency?: string | null;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `__invox_purchase_${orderId}`;
    if ((window as unknown as Record<string, boolean>)[key]) return;
    (window as unknown as Record<string, boolean>)[key] = true;
    trackPurchase({ sellerId, orderId, value, currency: currency ?? "INR" });
  }, [sellerId, orderId, value, currency]);

  return null;
}
