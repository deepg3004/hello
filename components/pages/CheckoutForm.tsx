"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2, Tag, X } from "lucide-react";

import { OrderBump } from "@/components/pages/OrderBump";
import type { OrderBumpConfig } from "@/lib/upsells";
import { GSTIN_REGEX, stateCodeFromGstin } from "@/lib/gst";
import { getRuntimePixelConfig } from "@/components/pages/PixelScripts";
import {
  fireGoogleConversion,
  fireMetaPurchaseEvent,
  fireTikTokPurchase,
} from "@/lib/pixel-events";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Razorpay Checkout types
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Form
// ----------------------------------------------------------------------------

const schema = z.object({
  buyer_name: z.string().min(2, "Enter your name"),
  buyer_email: z.string().email("Enter a valid email"),
  buyer_phone: z.string().min(8, "Enter a valid phone number"),
});

type FormValues = z.infer<typeof schema>;

export interface CheckoutFormProps {
  pageId: string;
  productId: string;
  productName: string;
  productDescription?: string | null;
  productImage?: string | null;
  price: number; // rupees
  currency?: string;
  initialBuyer?: { name?: string; email?: string; phone?: string };
  /** When present + enabled, render the bump checkbox and add it to the total. */
  orderBump?: OrderBumpConfig & { ready: boolean };
}

interface AppliedCoupon {
  code: string;
  coupon_id: string;
  discount_amount: number;
}

export function CheckoutForm(props: CheckoutFormProps) {
  const { toast } = useToast();
  const razorpayReady = useRazorpayScript();
  const currency = props.currency ?? "INR";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer_name: props.initialBuyer?.name ?? "",
      buyer_email: props.initialBuyer?.email ?? "",
      buyer_phone: props.initialBuyer?.phone ?? "",
    },
  });

  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bumpAccepted, setBumpAccepted] = useState(false);
  // Email-blur pre-capture lifecycle — we never fire for the same address
  // twice, but we do refresh on phone/name updates.
  const lastCapturedEmailRef = useRef<string | null>(null);

  // Optional GST / billing details (B2B invoice path) — opt-in via toggle so
  // the checkout stays one-screen for B2C buyers.
  const [gstOpen, setGstOpen] = useState(false);
  const [buyerGstin, setBuyerGstin] = useState("");
  const [billLine1, setBillLine1] = useState("");
  const [billLine2, setBillLine2] = useState("");
  const [billCity, setBillCity] = useState("");
  const [billPincode, setBillPincode] = useState("");

  const gstinUpper = buyerGstin.trim().toUpperCase();
  const gstinValid = gstinUpper === "" || GSTIN_REGEX.test(gstinUpper);

  const discount = coupon?.discount_amount ?? 0;
  const bumpReady = !!props.orderBump?.ready;
  const bumpPrice = Number(props.orderBump?.price ?? 0);
  const bumpExtra = bumpReady && bumpAccepted ? bumpPrice : 0;
  const total = Math.max(0, props.price - discount) + bumpExtra;

  // Cart-recovery prefill: if the URL carries ?r=<token>, look up the
  // abandoned cart and populate the buyer fields. Then strip the token
  // from the visible URL so it can't be shared accidentally.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const token = sp.get("r");
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/prefill?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const body = (await res.json()) as {
            ok?: boolean;
            buyer_name?: string | null;
            buyer_email?: string | null;
            buyer_phone?: string | null;
          };
          if (body.ok) {
            form.reset({
              buyer_name: body.buyer_name ?? form.getValues("buyer_name"),
              buyer_email:
                body.buyer_email ?? form.getValues("buyer_email"),
              buyer_phone: body.buyer_phone ?? form.getValues("buyer_phone"),
            });
            if (body.buyer_email) {
              lastCapturedEmailRef.current = body.buyer_email;
            }
            toast({
              title: "Welcome back",
              description: "We saved your cart — finish your purchase below.",
            });
          }
        }
      } catch {
        /* network noise — silent fallback */
      }
      try {
        sp.delete("r");
        const newQuery = sp.toString();
        const newUrl = `${window.location.pathname}${newQuery ? "?" + newQuery : ""}${window.location.hash}`;
        window.history.replaceState({}, "", newUrl);
      } catch {
        /* private windows / very old browsers */
      }
    })();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire-and-forget pre-capture on email blur once the user types a valid
  // address. The server is idempotent, so accidental double-fires are fine.
  function maybePreCapture() {
    const email = form.getValues("buyer_email")?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (lastCapturedEmailRef.current === email) return;
    lastCapturedEmailRef.current = email;
    const payload = {
      page_id: props.pageId,
      buyer_email: email,
      buyer_name: form.getValues("buyer_name") || undefined,
      buyer_phone: form.getValues("buyer_phone") || undefined,
      amount: total,
    };
    // Use sendBeacon when available (survives tab close); fallback to fetch.
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/checkout/pre-capture", blob);
        return;
      }
    } catch {
      /* fall through */
    }
    void fetch("/api/checkout/pre-capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  }

  // Pre-fill coupon code stashed by an exit-intent popup.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stashedKey = Object.keys(window.sessionStorage).find((k) =>
        k.startsWith("invoxai_coupon_"),
      );
      if (!stashedKey) return;
      const code = window.sessionStorage.getItem(stashedKey);
      if (code && !coupon && !couponInput) {
        setCouponInput(code);
      }
    } catch {
      /* sessionStorage may be blocked in private windows */
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    try {
      const buyerEmail = form.getValues("buyer_email");
      const qs = new URLSearchParams({
        code: couponInput.trim(),
        page_id: props.pageId,
        amount: String(props.price),
      });
      if (buyerEmail) qs.set("buyer_email", buyerEmail);
      const res = await fetch(`/api/coupons/validate?${qs.toString()}`);
      const body = (await res.json()) as
        | { valid: true; coupon_id: string; code: string; discount_amount: number }
        | { valid: false; reason: string };

      if (!body.valid) {
        toast({
          title: "Coupon not valid",
          description: body.reason,
          variant: "destructive",
        });
        return;
      }
      setCoupon({
        code: body.code,
        coupon_id: body.coupon_id,
        discount_amount: body.discount_amount,
      });
      toast({
        title: "Coupon applied",
        description: `-₹${body.discount_amount.toLocaleString("en-IN")}`,
      });
    } finally {
      setApplyingCoupon(false);
    }
  }

  function clearCoupon() {
    setCoupon(null);
    setCouponInput("");
  }

  async function onSubmit(values: FormValues) {
    if (!razorpayReady) {
      toast({
        title: "Checkout still loading",
        description: "Give it a second and try again.",
        variant: "destructive",
      });
      return;
    }
    if (gstOpen && gstinUpper && !gstinValid) {
      toast({
        title: "GSTIN looks invalid",
        description: "Check the 15-character format or clear the field.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    // Make sure pre-capture has fired before Razorpay opens.
    maybePreCapture();

    let createBody: {
      ok?: boolean;
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
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page_id: props.pageId,
          product_id: props.productId,
          amount: total,
          buyer_email: values.buyer_email,
          buyer_name: values.buyer_name,
          buyer_phone: values.buyer_phone,
          coupon_code: coupon?.code,
          bump_offered: bumpReady,
          bump_accepted: bumpReady && bumpAccepted,
          bump_product_id:
            bumpReady && bumpAccepted ? props.orderBump?.product_id : undefined,
          bump_amount: bumpReady && bumpAccepted ? bumpPrice : undefined,
          // Optional GST / billing — only forwarded when the buyer expanded
          // the section, otherwise the API treats it as a B2C sale.
          buyer_gstin: gstOpen && gstinUpper ? gstinUpper : undefined,
          buyer_state_code:
            gstOpen && gstinUpper
              ? stateCodeFromGstin(gstinUpper) ?? undefined
              : undefined,
          buyer_address:
            gstOpen && (billLine1 || billCity || billPincode)
              ? {
                  line1: billLine1 || undefined,
                  line2: billLine2 || undefined,
                  city: billCity || undefined,
                  state_code: stateCodeFromGstin(gstinUpper) ?? undefined,
                  pincode: billPincode || undefined,
                }
              : undefined,
        }),
      });
      createBody = (await res.json()) as typeof createBody;
      if (!res.ok || !createBody.razorpay_order_id) {
        throw new Error(createBody.error ?? "Couldn't start checkout");
      }
    } catch (err) {
      setSubmitting(false);
      toast({
        title: "Couldn't start checkout",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      return;
    }

    const options: RazorpayOptions = {
      key: createBody.key,
      amount: createBody.amount!,
      currency: createBody.currency ?? "INR",
      name: createBody.name ?? "InvoxAI",
      description: createBody.description ?? props.productName,
      order_id: createBody.razorpay_order_id!,
      prefill: {
        name: values.buyer_name,
        email: values.buyer_email,
        contact: values.buyer_phone,
      },
      notes: { invoxai_order_id: createBody.order_id ?? "" },
      theme: { color: "#0f0f10" },
      handler: async (response) => {
        try {
          const verifyRes = await fetch("/api/checkout/verify-payment", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: createBody.order_id,
            }),
          });
          const verifyBody = (await verifyRes.json()) as {
            ok?: boolean;
            redirect_url?: string;
            error?: string;
          };
          if (!verifyRes.ok || !verifyBody.ok) {
            throw new Error(verifyBody.error ?? "Verification failed");
          }
          // Client-side pixel fires — best-effort, never throws.
          try {
            const pixelCfg = getRuntimePixelConfig();
            if (pixelCfg) {
              const purchaseArgs = {
                value: total,
                currency: currency ?? "INR",
                order_id: createBody.order_id ?? "",
              };
              fireMetaPurchaseEvent(pixelCfg.meta_pixel_id, purchaseArgs);
              fireGoogleConversion(
                pixelCfg.google_ads_id,
                pixelCfg.google_ads_label,
                {
                  value: total,
                  currency: currency ?? "INR",
                  transaction_id: createBody.order_id,
                },
              );
              fireTikTokPurchase(pixelCfg.tiktok_pixel_id, purchaseArgs);
            }
          } catch (pixelErr) {
            console.warn("[checkout] pixel fire failed", pixelErr);
          }
          window.location.href = verifyBody.redirect_url ?? "/";
        } catch (e) {
          setSubmitting(false);
          toast({
            title: "Payment captured but verification failed",
            description:
              e instanceof Error ? e.message : "Contact support with your payment id.",
            variant: "destructive",
          });
        }
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          // abandoned_checkouts row was already created server-side; nothing
          // more to do — the dunning job will pick it up.
          toast({
            title: "Checkout cancelled",
            description:
              "We saved your cart. We'll email you a recovery link if you opted in.",
          });
        },
      },
    };

    const rzp = new window.Razorpay!(options);
    rzp.open();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ----- Buyer details ----- */}
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            We&apos;ll send the confirmation and any access links here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              id="checkout-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="buyer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyer_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          // Schedule one tick later so RHF's state is settled
                          // before we read form values for the pre-capture body.
                          setTimeout(maybePreCapture, 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyer_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        placeholder="+91 98765 43210"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ─── Optional GST / billing details ─── */}
              <div className="rounded-md border bg-muted/30 p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-sm font-medium"
                  onClick={() => setGstOpen((v) => !v)}
                >
                  <span>
                    Buying for a business? Add GSTIN
                    <span className="ml-2 text-xs text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {gstOpen ? "Hide" : "Add"}
                  </span>
                </button>
                {gstOpen && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        GSTIN
                      </label>
                      <Input
                        placeholder="27ABCDE1234F1Z5"
                        value={buyerGstin}
                        maxLength={15}
                        onChange={(e) =>
                          setBuyerGstin(e.target.value.toUpperCase())
                        }
                        style={{ textTransform: "uppercase" }}
                      />
                      {buyerGstin && !gstinValid && (
                        <p className="mt-1 text-xs text-destructive">
                          Invalid GSTIN format.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Billing address
                      </label>
                      <Input
                        placeholder="Address line 1"
                        value={billLine1}
                        onChange={(e) => setBillLine1(e.target.value)}
                      />
                    </div>
                    <Input
                      placeholder="Address line 2 (optional)"
                      value={billLine2}
                      onChange={(e) => setBillLine2(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="City"
                        value={billCity}
                        onChange={(e) => setBillCity(e.target.value)}
                      />
                      <Input
                        placeholder="Pincode"
                        value={billPincode}
                        maxLength={6}
                        inputMode="numeric"
                        onChange={(e) => setBillPincode(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll issue a B2B GST invoice with your GSTIN and
                      billing address.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ----- Order summary ----- */}
      <Card>
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
          <CardDescription>
            Secured by Razorpay. You won&apos;t be charged until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {props.productImage ? (
              <img
                src={props.productImage}
                alt={props.productName}
                className="h-14 w-14 rounded-md border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
                IXA
              </div>
            )}
            <div className="flex-1">
              <div className="font-medium">{props.productName}</div>
              {props.productDescription && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {props.productDescription}
                </p>
              )}
            </div>
            <div className="text-right font-medium">₹{props.price.toLocaleString("en-IN")}</div>
          </div>

          <Separator />

          {/* Coupon */}
          {!coupon ? (
            <div className="flex gap-2">
              <Input
                placeholder="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                disabled={applyingCoupon}
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyCoupon}
                disabled={applyingCoupon || !couponInput.trim()}
              >
                {applyingCoupon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-2 font-medium">
                <Check className="h-4 w-4 text-primary" />
                {coupon.code}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-primary">
                  -₹{coupon.discount_amount.toLocaleString("en-IN")}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={clearCoupon}
                  aria-label="Remove coupon"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            </div>
          )}

          {bumpReady && props.orderBump && (
            <>
              <Separator />
              <OrderBump
                config={props.orderBump}
                checked={bumpAccepted}
                onChange={setBumpAccepted}
              />
            </>
          )}

          <Separator />

          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={`₹${props.price.toLocaleString("en-IN")}`} />
            {discount > 0 && (
              <Row
                label="Discount"
                value={`-₹${discount.toLocaleString("en-IN")}`}
                muted
              />
            )}
            {bumpExtra > 0 && (
              <Row
                label={`+ ${props.orderBump?.title ?? "Bump"}`}
                value={`+₹${bumpExtra.toLocaleString("en-IN")}`}
              />
            )}
            <Row
              label="Total"
              value={`₹${total.toLocaleString("en-IN")} ${currency}`}
              emphasised
            />
          </div>

          <Button
            type="submit"
            form="checkout-form"
            className="w-full"
            size="lg"
            disabled={submitting || !razorpayReady}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pay ₹{total.toLocaleString("en-IN")}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to InvoxAI&apos;s terms. Refunds per the
            seller&apos;s policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasised,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasised?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        emphasised && "pt-1 text-base font-semibold",
        muted && "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
