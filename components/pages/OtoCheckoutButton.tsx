"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
    let body: {
      razorpay_order_id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      key?: string;
      name?: string;
      description?: string;
      buyer_name?: string;
      buyer_email?: string;
      buyer_phone?: string;
      error?: string;
    };
    try {
      const res = await fetch("/api/checkout/create-oto-order", { method: "POST" });
      body = (await res.json()) as typeof body;
      if (!res.ok || !body.razorpay_order_id) {
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

    const options: RazorpayOptions = {
      key: body.key,
      amount: body.amount!,
      currency: body.currency ?? "INR",
      name: body.name ?? "InvoxAI",
      description: body.description ?? "One-time offer",
      order_id: body.razorpay_order_id!,
      prefill: {
        name: body.buyer_name,
        email: body.buyer_email,
        contact: body.buyer_phone,
      },
      theme: { color: "#0f0f10" },
      handler: async (response) => {
        try {
          const v = await fetch("/api/checkout/verify-payment", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: body.order_id,
            }),
          });
          const vbody = (await v.json()) as { ok?: boolean; redirect_url?: string; error?: string };
          if (!v.ok || !vbody.ok) throw new Error(vbody.error ?? "Verification failed");
          // Skip another OTO redirect on the follow-on order.
          window.location.href = `/order/${body.order_id}?status=success`;
        } catch (e) {
          setBusy(false);
          toast({
            title: "Verification failed",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
        }
      },
      modal: { ondismiss: () => setBusy(false) },
    };
    const rzp = new window.Razorpay!(options);
    rzp.open();
  }

  return (
    <Button
      size="lg"
      className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
      onClick={accept}
      disabled={busy || !ready}
      aria-label={declineText ? `${ctaText} (or ${declineText})` : ctaText}
    >
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {ctaText}
    </Button>
  );
}
