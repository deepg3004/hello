import { RotateCcw, ShieldCheck, Truck } from "lucide-react";

/** Shopify-style trust strip shown on the product detail page. */
export function TrustBadges({
  requiresShipping,
  freeShippingOver,
}: {
  requiresShipping: boolean;
  freeShippingOver: number | null;
}) {
  const items = [
    {
      icon: ShieldCheck,
      title: "Secure checkout",
      sub: "Payments via Razorpay",
    },
    requiresShipping
      ? {
          icon: Truck,
          title:
            freeShippingOver && freeShippingOver > 0
              ? `Free shipping over ₹${freeShippingOver}`
              : "Fast delivery",
          sub: "Tracked dispatch",
        }
      : {
          icon: Truck,
          title: "Instant access",
          sub: "Delivered to your email",
        },
    {
      icon: RotateCcw,
      title: "Buyer support",
      sub: "Reach the seller anytime",
    },
  ];
  return (
    <div className="sf-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <it.icon className="sf-accent h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{it.title}</p>
            <p className="sf-muted text-xs">{it.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
