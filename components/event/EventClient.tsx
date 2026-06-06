"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";
import {
  launchCheckout,
  type CreateOrderResponse,
} from "@/lib/checkout-launch";

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
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}
type RazorpayCtor = new (o: RazorpayOptions) => { open: () => void };
function getRazorpay(): RazorpayCtor | undefined {
  return (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
}

export function EventClient({
  slug,
  title,
  price,
  currency,
}: {
  slug: string;
  title: string;
  price: number;
  currency: string;
}) {
  const paid = price > 0;
  const [ready, setReady] = useState(!paid);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!paid) return;
    if (getRazorpay()) {
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SDK;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, [paid]);

  async function register() {
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (paid && !ready) {
      setError("Payment is still loading — try again.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          buyer_name: name.trim() || undefined,
          buyer_email: email.trim().toLowerCase(),
          buyer_phone: phone.trim() || undefined,
        }),
      });
      const b = (await res.json()) as CreateOrderResponse & {
        free?: boolean;
        registration_id?: string;
      };
      if (!res.ok || !b.ok) throw new Error(b.error ?? "Couldn't register");

      if (b.free) {
        setDone(true);
        setBusy(false);
        return;
      }

      await launchCheckout(b, {
        verifyUrl: "/api/events/verify",
        verifyExtra: { registration_id: b.registration_id },
        prefill: { name, email, phone },
        themeColor: "#4f46e5",
        onSuccess: () => {
          setDone(true);
          setBusy(false);
        },
        onError: (msg) => {
          setBusy(false);
          setError(msg);
        },
        onDismiss: () => setBusy(false),
      });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
        🎉 You&apos;re registered! Check your email for the details + calendar invite.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button className="w-full" onClick={register} disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {paid ? `Register — ${formatINR(Math.round(price * 100))}` : "Register free"}
      </Button>
    </div>
  );
}
