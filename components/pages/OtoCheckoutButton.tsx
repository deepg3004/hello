"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  launchCheckout,
  type CreateOrderResponse,
} from "@/lib/checkout-launch";

// window.Razorpay is declared globally in CheckoutForm.tsx. We reuse those
// types here via a lightweight inferred shape — no second `declare global`.
type RazorpayCtor = NonNullable<Window["Razorpay"]>;
type RazorpayOptions = ConstructorParameters<RazorpayCtor>[0];

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

function useRazorpayScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Razorpay) {
      setReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SDK}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SDK;
    s.async = true;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);
  return ready;
}

interface OtoCheckoutButtonProps {
  ctaText: string;
  declineText: string;
}

export function OtoCheckoutButton({ ctaText, declineText }: OtoCheckoutButtonProps) {
  const { toast } = useToast();
  const ready = useRazorpayScript();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!ready) {
      toast({ title: "Checkout still loading", description: "Try again in a sec." });
      return;
    }
    setBusy(true);
    let body: CreateOrderResponse;
    try {
      const res = await fetch("/api/checkout/create-oto-order", { method: "POST" });
      body = (await res.json()) as CreateOrderResponse;
      if (!res.ok || !body.gateway) {
        throw new Error(body.error ?? "Couldn't start checkout");
      }
    } catch (e) {
      setBusy(false);
      toast({
        title: "Couldn't start checkout",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      return;
    }

    await launchCheckout(body, {
      verifyUrl: "/api/checkout/verify-payment",
      prefill: {
        name: body.buyer_name,
        email: body.buyer_email,
        phone: body.buyer_phone,
      },
      themeColor: "#0f0f10",
      onSuccess: () => {
        // Go straight to the order page — skip the verify redirect so we don't
        // chain into another OTO on the follow-on order.
        window.location.href = `/order/${body.order_id}?status=success`;
      },
      onError: (msg) => {
        setBusy(false);
        toast({ title: "Payment failed", description: msg, variant: "destructive" });
      },
      onDismiss: () => setBusy(false),
    });
  }

  return (
    <Button
      size="lg"
      className="w-full bg-none bg-amber-500 text-zinc-950 hover:bg-amber-400"
      onClick={accept}
      disabled={busy || !ready}
      aria-label={declineText ? `${ctaText} (or ${declineText})` : ctaText}
    >
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {ctaText}
    </Button>
  );
}
