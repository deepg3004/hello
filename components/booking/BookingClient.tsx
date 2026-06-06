"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Slot } from "@/lib/booking";
import { launchCheckout } from "@/lib/checkout-launch";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RzpCtor {
  new (options: Record<string, unknown>): { open: () => void };
}

const RZP_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function BookingClient({
  slug,
  title,
  price,
  slots,
}: {
  slug: string;
  title: string;
  price: number;
  slots: Slot[];
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Preload Razorpay checkout for paid bookings.
  useEffect(() => {
    if (price <= 0) return;
    if (document.querySelector(`script[src="${RZP_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = RZP_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, [price]);

  async function submit() {
    if (!selected) {
      toast({ variant: "destructive", title: "Pick a time slot" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ variant: "destructive", title: "Enter a valid email" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          start_iso: selected,
          buyer_name: name,
          buyer_email: email,
          buyer_phone: phone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ variant: "destructive", title: "Couldn't book", description: data.error });
        setSubmitting(false);
        return;
      }
      if (data.free) {
        setDone(true);
        setSubmitting(false);
        return;
      }
      // Paid → open the seller's gateway (Razorpay or Cashfree).
      await launchCheckout(data, {
        verifyUrl: "/api/bookings/verify",
        verifyExtra: { booking_id: data.booking_id },
        prefill: { name: data.buyer_name, email: data.buyer_email, phone: data.buyer_phone },
        onSuccess: () => {
          setDone(true);
          setSubmitting(false);
        },
        onError: (msg) => {
          toast({ variant: "destructive", title: "Payment not confirmed", description: msg });
          setSubmitting(false);
        },
        onDismiss: () => setSubmitting(false),
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Network error", description: e instanceof Error ? e.message : String(e) });
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 font-sora text-xl font-semibold text-emerald-900">
          Booking confirmed!
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          We&apos;ve emailed your confirmation. See you then.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pick a time (IST)
        </h2>
        {slots.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No slots available right now. Please check back later.
          </p>
        ) : (
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {slots.map((s) => (
              <button
                key={s.startIso}
                onClick={() => setSelected(s.startIso)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs transition",
                  selected === s.startIso
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border hover:border-primary/50",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label className="text-xs">Phone (optional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {price > 0 ? `Pay ₹${price.toLocaleString("en-IN")} & book` : "Confirm booking"}
          </Button>
        </div>
      )}
    </div>
  );
}
