"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";

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
      const b = (await res.json()) as {
        ok?: boolean;
        free?: boolean;
        error?: string;
        key?: string;
        amount?: number;
        currency?: string;
        razorpay_order_id?: string;
        registration_id?: string;
      };
      if (!res.ok || !b.ok) throw new Error(b.error ?? "Couldn't register");

      if (b.free) {
        setDone(true);
        setBusy(false);
        return;
      }

      const Razorpay = getRazorpay();
      if (!Razorpay) throw new Error("Payment is still loading");
      const rzp = new Razorpay({
        key: b.key!,
        amount: b.amount!,
        currency: b.currency ?? currency,
        name: "InvoxAI",
        description: title,
        order_id: b.razorpay_order_id!,
        prefill: { name, email, contact: phone },
        theme: { color: "#4f46e5" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r) => {
          try {
            const vr = await fetch("/api/events/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                registration_id: b.registration_id,
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              }),
            });
            const vb = (await vr.json()) as { ok?: boolean; error?: string };
            if (!vr.ok || !vb.ok) throw new Error(vb.error ?? "Verification failed");
            setDone(true);
            setBusy(false);
          } catch (e) {
            setBusy(false);
            setError(e instanceof Error ? e.message : "Verification failed");
          }
        },
      });
      rzp.open();
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
