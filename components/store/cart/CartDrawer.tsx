"use client";

import { useEffect, useState } from "react";
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/utils";
import { useCart, lineKey } from "./CartProvider";

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (r: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance {
  open: () => void;
}

type RazorpayCtor = new (o: RazorpayOptions) => RazorpayInstance;
function getRazorpay(): RazorpayCtor | undefined {
  return (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
}

function useRazorpay() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (getRazorpay()) {
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SDK;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);
  return ready;
}

export function CartDrawer() {
  const { items, count, subtotal, setQty, remove, clear, isOpen: open, setOpen } = useCart();
  const { toast } = useToast();
  const razorpayReady = useRazorpay();
  const [paying, setPaying] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  const [promo, setPromo] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);

  const discount = applied ? Math.min(subtotal, applied.discount) : 0;
  const payable = Math.max(0, subtotal - discount);

  async function applyPromo() {
    const code = promo.trim();
    if (!code) return;
    setApplying(true);
    try {
      const res = await fetch("/api/checkout/validate-cart-coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id ?? null, quantity: i.quantity })),
          code,
          buyer_email: email.trim().toLowerCase() || undefined,
        }),
      });
      const b = (await res.json()) as { ok?: boolean; code?: string; discount_amount?: number; error?: string };
      if (!res.ok || !b.ok) throw new Error(b.error ?? "Invalid promo code");
      setApplied({ code: b.code ?? code, discount: b.discount_amount ?? 0 });
      toast({ title: `Promo applied — ${formatINR(Math.round((b.discount_amount ?? 0) * 100))} off` });
    } catch (e) {
      setApplied(null);
      toast({ variant: "destructive", title: "Couldn't apply promo", description: e instanceof Error ? e.message : undefined });
    } finally {
      setApplying(false);
    }
  }

  function clearPromo() {
    setApplied(null);
    setPromo("");
  }

  async function checkout() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ variant: "destructive", title: "Enter a valid email" });
      return;
    }
    if (!razorpayReady) {
      toast({ variant: "destructive", title: "Payment is still loading — try again." });
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/checkout/create-cart-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id ?? null, quantity: i.quantity })),
          buyer_email: email.trim().toLowerCase(),
          buyer_name: name.trim() || undefined,
          buyer_phone: phone.trim() || undefined,
          buyer_address:
            line1 || city || pincode ? { line1, city, pincode } : undefined,
          coupon_code: applied?.code || undefined,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        key?: string;
        amount?: number;
        currency?: string;
        name?: string;
        description?: string;
        razorpay_order_id?: string;
        order_id?: string;
      };
      if (!res.ok || !body.ok || !body.razorpay_order_id) {
        throw new Error(body.error ?? "Couldn't start checkout");
      }

      const Razorpay = getRazorpay();
      if (!Razorpay) throw new Error("Payment is still loading");
      const rzp = new Razorpay({
        key: body.key!,
        amount: body.amount!,
        currency: body.currency ?? "INR",
        name: body.name ?? "InvoxAI",
        description: body.description,
        order_id: body.razorpay_order_id,
        prefill: { name, email, contact: phone },
        theme: { color: "#4f46e5" },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (r) => {
          try {
            const vr = await fetch("/api/checkout/verify-cart-payment", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
                order_id: body.order_id,
              }),
            });
            const vb = (await vr.json()) as { ok?: boolean; redirect_url?: string; error?: string };
            if (!vr.ok || !vb.ok) throw new Error(vb.error ?? "Verification failed");
            clear();
            window.location.href = vb.redirect_url ?? "/";
          } catch (e) {
            setPaying(false);
            toast({
              variant: "destructive",
              title: "Payment captured but verification failed",
              description: e instanceof Error ? e.message : undefined,
            });
          }
        },
      });
      rzp.open();
    } catch (e) {
      setPaying(false);
      toast({ variant: "destructive", title: "Checkout failed", description: e instanceof Error ? e.message : undefined });
    }
  }

  if (count === 0 && !open) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-zinc-700"
          aria-label="Open cart"
        >
          <ShoppingCart className="h-4 w-4" />
          Cart
          <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-zinc-900">
            {count}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-3">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            items.map((it) => (
              <div key={lineKey(it)} className="flex items-center gap-3">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  {it.variant_name && (
                    <p className="truncate text-xs text-muted-foreground">{it.variant_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatINR(Math.round(it.price * 100))}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(lineKey(it), it.quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{it.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(lineKey(it), it.quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(lineKey(it))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatINR(Math.round(subtotal * 100))}</span>
            </div>
            {applied ? (
              <div className="flex items-center justify-between text-sm text-emerald-600">
                <span className="inline-flex items-center gap-1">
                  Promo “{applied.code}”
                  <button onClick={clearPromo} className="text-xs underline text-muted-foreground hover:text-foreground">
                    remove
                  </button>
                </span>
                <span>−{formatINR(Math.round(discount * 100))}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Promo code"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                />
                <Button variant="outline" onClick={applyPromo} disabled={applying || !promo.trim()}>
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{formatINR(Math.round(payable * 100))}</span>
            </div>
            <p className="text-xs text-muted-foreground">Shipping (if any) is added at payment.</p>
            <div className="grid gap-2">
              <Input placeholder="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Delivery address (physical items)</summary>
                <div className="mt-2 grid gap-2">
                  <Input placeholder="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                    <Input placeholder="PIN code" value={pincode} onChange={(e) => setPincode(e.target.value)} />
                  </div>
                </div>
              </details>
            </div>
            <Button className="w-full" onClick={checkout} disabled={paying}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pay {formatINR(Math.round(payable * 100))}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
