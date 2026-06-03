"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/utils";

// ── Razorpay Checkout types (mirror components/pages/CheckoutForm.tsx) ───────
interface RazorpayOptions {
  key?: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance {
  open: () => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

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

// ₹500, ₹1,000, ₹2,000, ₹5,000, ₹10,000 — must match RECHARGE_AMOUNTS_PAISE
// in app/api/wallet/recharge/route.ts.
const AMOUNTS_PAISE = [50000, 100000, 200000, 500000, 1000000];

export function WalletRechargePanel() {
  const router = useRouter();
  const { toast } = useToast();
  const scriptReady = useRazorpayScript();
  const [busy, setBusy] = useState<number | null>(null);

  async function recharge(amountPaise: number) {
    if (!scriptReady || !window.Razorpay) {
      toast({
        variant: "destructive",
        title: "Still loading",
        description: "Payment widget isn't ready yet — try again in a moment.",
      });
      return;
    }
    setBusy(amountPaise);
    try {
      const res = await fetch("/api/wallet/recharge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_paise: amountPaise }),
      });
      const data = (await res.json()) as {
        razorpay_order_id?: string;
        amount?: number;
        currency?: string;
        key?: string;
        error?: string;
      };
      if (!res.ok || !data.razorpay_order_id) {
        throw new Error(data.error ?? "Could not start recharge");
      }

      const options: RazorpayOptions = {
        key: data.key,
        amount: data.amount!,
        currency: data.currency ?? "INR",
        name: "InvoxAI Wallet",
        description: `Wallet recharge — ${formatINR(amountPaise)}`,
        order_id: data.razorpay_order_id,
        notes: { purpose: "wallet_recharge" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/wallet/verify-recharge", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount_paise: amountPaise,
              }),
            });
            const verifyBody = (await verifyRes.json()) as {
              ok?: boolean;
              error?: string;
            };
            if (!verifyRes.ok || !verifyBody.ok) {
              throw new Error(verifyBody.error ?? "Verification failed");
            }
            toast({
              title: "Wallet recharged 🎉",
              description: `${formatINR(amountPaise)} added to your balance.`,
            });
            router.refresh();
          } catch (e) {
            toast({
              variant: "destructive",
              title: "Recharge not confirmed",
              description:
                e instanceof Error
                  ? e.message
                  : "Payment captured but verification failed — contact support.",
            });
          } finally {
            setBusy(null);
          }
        },
        theme: { color: "#0ea5e9" },
        modal: { ondismiss: () => setBusy(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't start recharge",
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recharge wallet</CardTitle>
        <CardDescription>
          Top up your balance to keep your store active. Payments are processed
          securely by Razorpay.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {AMOUNTS_PAISE.map((amt) => (
            <Button
              key={amt}
              variant="outline"
              disabled={busy !== null}
              onClick={() => recharge(amt)}
            >
              {busy === amt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formatINR(amt)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
