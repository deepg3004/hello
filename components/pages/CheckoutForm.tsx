"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  Tag,
  X,
} from "lucide-react";

import { OrderBump } from "@/components/pages/OrderBump";
import { useCheckoutConfig } from "@/components/pages/CheckoutConfig";
import { getDefaultBuyerAddressAction } from "@/actions/buyer-account";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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

// Cashfree Checkout types (JS SDK v3)
interface CashfreeCheckoutResult {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}
interface CashfreeInstance {
  checkout: (opts: {
    paymentSessionId: string;
    redirectTarget?: string;
  }) => Promise<CashfreeCheckoutResult>;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";
const CASHFREE_SDK = "https://sdk.cashfree.com/js/v3/cashfree.js";

/** Load the Cashfree JS SDK on demand (only when a buyer pays via Cashfree). */
function loadCashfreeSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.Cashfree) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CASHFREE_SDK}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("sdk load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = CASHFREE_SDK;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk load failed"));
    document.body.appendChild(s);
  });
}

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

// Name is optional at the schema level; when the form is *not* in "name
// optional" mode we enforce a minimum length manually in onSubmit (preserving
// the original required-name behaviour for fixed-price templates).
const schema = z.object({
  buyer_name: z.string().optional(),
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
  /**
   * Optional hex / CSS colour used for the Pay button background, the
   * coupon-applied tick, and Razorpay's modal accent. Templates pass their
   * own theme colour (#d4af37 gold for course, #f97316 orange for coaching,
   * #4F46E5 indigo for digital, etc.). Defaults to indigo when not set.
   */
  primaryColor?: string;
  /** Seller-defined extra checkout questions. */
  questions?: Array<{ label: string; required: boolean }>;
  /** Pin the Pay button to a fixed bottom action bar on mobile (Magic-Checkout
   *  style). Used on the dedicated /checkout route, which reserves bottom space
   *  for it. Off for inline checkout embedded in payment templates. */
  stickyPay?: boolean;
  /**
   * "Pay what you like" mode (donation / name-your-price). When set, the buyer
   * chooses the amount from preset pills (or types their own ≥ `min`) and that
   * drives the total instead of the fixed `price`. The server only honours this
   * when the page's `page_config.pwyl_enabled` flag is true, and never charges
   * below the product price — so the pills/min must all be ≥ the product price.
   */
  payWhatYouLike?: {
    presets: Array<{ amount: number; label?: string; popular?: boolean }>;
    /** Minimum the buyer may enter (defaults to `price`). */
    min?: number;
  };
  /** Override the Pay button label (e.g. "Make Payment"). Defaults to
   *  "Pay ₹<total> securely". */
  payLabel?: string;
  /**
   * Make the Name field optional and move it below email/phone. When the buyer
   * leaves it blank we derive a receipt name from their email's local part.
   * Defaults to true whenever `payWhatYouLike` is set (the name-your-price card
   * leads with email), false otherwise. */
  nameOptional?: boolean;
  /** Render the real form for the editor live preview WITHOUT any network side
   *  effects (no Razorpay, pre-capture, coupon or prefill calls). Lets sellers
   *  see the actual checkout design while editing. */
  preview?: boolean;
  /** Physical product — collect a delivery address (Session 10). The seller's
   *  flat shipping fee is added server-side. */
  requiresShipping?: boolean;
}

interface AppliedCoupon {
  code: string;
  coupon_id: string;
  discount_amount: number;
}

// Per-device remember-me for returning buyers (name/email/phone they last used
// on this storefront). Origin-scoped, so it never crosses storefronts.
const BUYER_LS_KEY = "invoxai_buyer_info";

export function CheckoutForm(props: CheckoutFormProps) {
  const { toast } = useToast();
  const razorpayReady = useRazorpayScript();
  const currency = props.currency ?? "INR";
  const primaryColor = props.primaryColor ?? "#4F46E5";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer_name: props.initialBuyer?.name ?? "",
      buyer_email: props.initialBuyer?.email ?? "",
      buyer_phone: props.initialBuyer?.phone ?? "",
    },
  });

  // ── Local UI state ────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [availCoupons, setAvailCoupons] = useState<
    { code: string; label: string; min_order: number }[]
  >([]);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  // Brief celebratory popup when a coupon is applied (holds the saved amount).
  const [celebrateSaved, setCelebrateSaved] = useState<number | null>(null);
  // Answers to seller-defined custom questions (keyed by question label).
  const customQuestions = props.questions ?? [];
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // True while Razorpay's modal is open in front — we dim the form behind it
  // and block clicks so the user can't double-submit.
  const [modalOpen, setModalOpen] = useState(false);
  const [bumpAccepted, setBumpAccepted] = useState(false);
  // Last-fired failure banner — populated when Razorpay errors OR the verify
  // step fails. Cleared on the next submit attempt.
  const [failure, setFailure] = useState<string | null>(null);
  // Post-payment success splash — shown briefly before redirect so the buyer
  // sees confirmation instead of staring at a frozen form.
  const [success, setSuccess] = useState(false);

  // ── Pay-what-you-like state ───────────────────────────────────────────
  // Props win; otherwise fall back to the page-level checkout config (set by
  // the Pricing → Custom price setting) so it works on any payment template.
  const checkoutCfg = useCheckoutConfig();
  const preview = !!props.preview;
  const pwyl = props.payWhatYouLike ?? checkoutCfg?.payWhatYouLike;
  const payLabel = props.payLabel ?? checkoutCfg?.payLabel;
  // The name-your-price card leads with email and treats name as optional.
  const nameOptional = props.nameOptional ?? !!pwyl;
  const pwylMin = pwyl?.min ?? props.price;
  const pwylDefault =
    pwyl?.presets.find((p) => p.popular)?.amount ??
    pwyl?.presets[0]?.amount ??
    pwylMin;
  const [chosenAmount, setChosenAmount] = useState<number>(pwylDefault);
  const [otherMode, setOtherMode] = useState(false);
  const [otherInput, setOtherInput] = useState("");

  const lastCapturedEmailRef = useRef<string | null>(null);

  // ── Optional GST / billing details (B2B invoice path) ─────────────────
  const [gstOpen, setGstOpen] = useState(false);
  const [buyerGstin, setBuyerGstin] = useState("");
  const [billLine1, setBillLine1] = useState("");
  const [billLine2, setBillLine2] = useState("");
  const [billCity, setBillCity] = useState("");
  const [billPincode, setBillPincode] = useState("");

  // Shipping address (physical products only).
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [shipPincode, setShipPincode] = useState("");
  const [shipError, setShipError] = useState<string | null>(null);
  const gstinUpper = buyerGstin.trim().toUpperCase();
  const gstinValid = gstinUpper === "" || GSTIN_REGEX.test(gstinUpper);

  // ── Derived totals ────────────────────────────────────────────────────
  const discount = coupon?.discount_amount ?? 0;
  const bumpReady = !!props.orderBump?.ready;
  const bumpPrice = Number(props.orderBump?.price ?? 0);
  const bumpExtra = bumpReady && bumpAccepted ? bumpPrice : 0;
  const subtotal = pwyl ? chosenAmount : props.price;
  const total = Math.max(0, subtotal - discount) + bumpExtra;
  const hasPrice = subtotal > 0;

  // ── Cart-recovery prefill: ?r=<token> populates the form once ────────
  useEffect(() => {
    if (typeof window === "undefined" || preview) return;
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

  // ── Saved-address autofill: signed-in buyers (physical products) get their
  //    default address prefilled. Only fills EMPTY fields so it never clobbers
  //    anything the buyer typed. No-ops when signed out / none saved. ────────
  useEffect(() => {
    if (preview || !props.requiresShipping) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getDefaultBuyerAddressAction();
        if (cancelled || !r.ok || !r.address) return;
        const a = r.address;
        setShipLine1((v) => v || a.line1);
        setShipLine2((v) => v || (a.line2 ?? ""));
        setShipCity((v) => v || a.city);
        setShipState((v) => v || (a.state ?? ""));
        setShipPincode((v) => v || a.pincode);
        if (a.full_name && !form.getValues("buyer_name")) {
          form.setValue("buyer_name", a.full_name);
        }
        if (a.phone && !form.getValues("buyer_phone")) {
          form.setValue("buyer_phone", a.phone);
        }
      } catch {
        /* silent — autofill is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the seller's publicly-listed promo codes for this page.
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/coupons/available?page_id=${encodeURIComponent(props.pageId)}`);
        const b = (await res.json()) as {
          coupons?: { code: string; label: string; min_order: number }[];
        };
        if (!cancelled && b.coupons && b.coupons.length > 0) {
          setAvailCoupons(b.coupons);
          setCouponOpen(true); // surface the offers
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill coupon stashed by an exit-intent popup, and open the panel.
  useEffect(() => {
    if (typeof window === "undefined" || preview) return;
    try {
      const stashedKey = Object.keys(window.sessionStorage).find((k) =>
        k.startsWith("invoxai_coupon_"),
      );
      if (!stashedKey) return;
      const code = window.sessionStorage.getItem(stashedKey);
      if (code && !coupon && !couponInput) {
        setCouponInput(code);
        setCouponOpen(true);
      }
    } catch {
      /* sessionStorage may be blocked in private windows */
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-apply a coupon passed via ?coupon=CODE — the shareable discount link.
  // The discounted total then shows immediately without the buyer typing it.
  useEffect(() => {
    if (typeof window === "undefined" || preview) return;
    const code = new URLSearchParams(window.location.search).get("coupon");
    if (code && !coupon) {
      setCouponInput(code);
      setCouponOpen(true);
      void applyCoupon(code);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Returning-customer auto-fill ──────────────────────────────────────
  // Recognise a repeat buyer and prefill name/email/phone: first from the
  // details they used last time on this device (localStorage, instant), then
  // from their signed-in session (verified, via /api/buyer/profile) which wins
  // for any still-empty field. Only fills fields the buyer hasn't typed, and
  // defers to the cart-recovery prefill (?r=) above when present.
  const [recognized, setRecognized] = useState(false);
  function fillEmptyBuyer(b: {
    name?: string;
    email?: string;
    phone?: string;
  }): boolean {
    let touched = false;
    if (b.name && !form.getValues("buyer_name")) {
      form.setValue("buyer_name", b.name);
      touched = true;
    }
    if (b.email && !form.getValues("buyer_email")) {
      form.setValue("buyer_email", b.email);
      lastCapturedEmailRef.current = b.email;
      touched = true;
    }
    if (b.phone && !form.getValues("buyer_phone")) {
      form.setValue("buyer_phone", b.phone);
      touched = true;
    }
    return touched;
  }
  useEffect(() => {
    if (preview || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("r")) return;

    try {
      const raw = window.localStorage.getItem(BUYER_LS_KEY);
      if (raw) fillEmptyBuyer(JSON.parse(raw));
    } catch {
      /* private mode / bad json — ignore */
    }

    void (async () => {
      try {
        const res = await fetch("/api/buyer/profile", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          ok?: boolean;
          buyer?: { name?: string; email?: string; phone?: string };
        };
        if (body.ok && body.buyer) {
          fillEmptyBuyer(body.buyer);
          setRecognized(true);
        }
      } catch {
        /* offline — localStorage already applied */
      }
    })();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the buyer's details for next time, after a successful payment.
  function stashBuyerLocally() {
    if (preview || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        BUYER_LS_KEY,
        JSON.stringify({
          name: form.getValues("buyer_name") || "",
          email: form.getValues("buyer_email") || "",
          phone: form.getValues("buyer_phone") || "",
        }),
      );
    } catch {
      /* private mode — ignore */
    }
  }

  // ── Returning-customer login (email OTP) ──────────────────────────────
  // Lets a buyer who purchased before pull their saved details in, by proving
  // the email with a 6-digit code (reuses the /account buyer-portal flow).
  const [rcOpen, setRcOpen] = useState(false);
  const [rcStage, setRcStage] = useState<"email" | "otp">("email");
  const [rcEmail, setRcEmail] = useState("");
  const [rcOtp, setRcOtp] = useState("");
  const [rcBusy, setRcBusy] = useState(false);
  const [rcMsg, setRcMsg] = useState<string | null>(null);

  async function rcSendCode() {
    const email = rcEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRcMsg("Enter a valid email address.");
      return;
    }
    setRcBusy(true);
    setRcMsg(null);
    try {
      const res = await fetch("/api/buyer/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setRcStage("otp");
        setRcMsg("If that email has purchases, a code is on its way.");
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setRcMsg(b.error ?? "Couldn't send a code. Try again.");
      }
    } catch {
      setRcMsg("Network error. Try again.");
    } finally {
      setRcBusy(false);
    }
  }

  async function rcVerify() {
    const email = rcEmail.trim().toLowerCase();
    const otp = rcOtp.trim();
    if (!/^\d{4,8}$/.test(otp)) {
      setRcMsg("Enter the code from your email.");
      return;
    }
    setRcBusy(true);
    setRcMsg(null);
    try {
      const res = await fetch("/api/buyer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setRcMsg(b.error ?? "That code didn't work.");
        return;
      }
      // Cookie is set — pull the verified profile and fill the form.
      try {
        const pr = await fetch("/api/buyer/profile", { cache: "no-store" });
        const body = (await pr.json()) as {
          ok?: boolean;
          buyer?: { name?: string; email?: string; phone?: string };
        };
        if (body.ok && body.buyer) {
          if (body.buyer.name) form.setValue("buyer_name", body.buyer.name);
          if (body.buyer.email) {
            form.setValue("buyer_email", body.buyer.email);
            lastCapturedEmailRef.current = body.buyer.email;
          }
          if (body.buyer.phone) form.setValue("buyer_phone", body.buyer.phone);
          setRecognized(true);
        }
      } catch {
        /* profile fetch failed — cookie is still set, fields stay as typed */
      }
      setRcOpen(false);
      setRcStage("email");
      setRcOtp("");
      setRcMsg(null);
      toast({
        title: "Welcome back",
        description: "We've filled in your details.",
      });
    } catch {
      setRcMsg("Network error. Try again.");
    } finally {
      setRcBusy(false);
    }
  }

  // Fire-and-forget pre-capture on email blur once the user types a valid
  // address. The server is idempotent, so accidental double-fires are fine.
  function maybePreCapture() {
    if (preview) return;
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

  async function applyCoupon(codeArg?: string) {
    if (preview) return;
    const code = (codeArg ?? couponInput).trim();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const buyerEmail = form.getValues("buyer_email");
      const qs = new URLSearchParams({
        code,
        page_id: props.pageId,
        amount: String(subtotal),
      });
      if (buyerEmail) qs.set("buyer_email", buyerEmail);
      const res = await fetch(`/api/coupons/validate?${qs.toString()}`);
      const body = (await res.json()) as
        | { valid: true; coupon_id: string; code: string; discount_amount: number }
        | { valid: false; reason: string };
      if (!body.valid) {
        setCouponError(body.reason);
        return;
      }
      setCoupon({
        code: body.code,
        coupon_id: body.coupon_id,
        discount_amount: body.discount_amount,
      });
      // Celebrate — animated popup that auto-dismisses.
      setCelebrateSaved(body.discount_amount);
      setTimeout(() => setCelebrateSaved(null), 2800);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function clearCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  // Shared post-payment confirmation: verify on the server, fire pixels, show
  // the success splash, redirect. Used by the Cashfree flow (Razorpay keeps its
  // own inline handler). `verifyReqBody` must include order_id.
  async function completeVerification(
    verifyReqBody: Record<string, unknown>,
    orderId: string,
  ) {
    const verifyRes = await fetch("/api/checkout/verify-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(verifyReqBody),
    });
    const verifyBody = (await verifyRes.json()) as {
      ok?: boolean;
      redirect_url?: string;
      error?: string;
    };
    if (!verifyRes.ok || !verifyBody.ok) {
      throw new Error(verifyBody.error ?? "Verification failed");
    }
    try {
      const pixelCfg = getRuntimePixelConfig();
      if (pixelCfg) {
        const purchaseArgs = {
          value: total,
          currency: currency ?? "INR",
          order_id: orderId,
        };
        fireMetaPurchaseEvent(pixelCfg.meta_pixel_id, purchaseArgs);
        fireGoogleConversion(pixelCfg.google_ads_id, pixelCfg.google_ads_label, {
          value: total,
          currency: currency ?? "INR",
          transaction_id: orderId,
        });
        fireTikTokPurchase(pixelCfg.tiktok_pixel_id, purchaseArgs);
      }
    } catch (pixelErr) {
      console.warn("[checkout] pixel fire failed", pixelErr);
    }
    stashBuyerLocally();
    setModalOpen(false);
    setSuccess(true);
    window.dispatchEvent(new Event("invox:checkout-complete"));
    setTimeout(() => {
      window.location.href = verifyBody.redirect_url ?? "/";
    }, 700);
  }

  // Cashfree buyer flow: load the SDK, open the hosted modal with the payment
  // session, then confirm by order status on the server (Cashfree has no
  // in-checkout signature; the webhook is the backstop if the buyer drops off).
  async function launchCashfree(createBody: {
    order_id?: string;
    cashfree?: { paymentSessionId?: string; mode?: string };
  }) {
    const cf = createBody.cashfree;
    if (!cf?.paymentSessionId) {
      setSubmitting(false);
      setFailure("Couldn't start Cashfree checkout.");
      return;
    }
    try {
      await loadCashfreeSdk();
    } catch {
      setSubmitting(false);
      setFailure("Couldn't load the payment SDK. Refresh and try again.");
      return;
    }
    const Cashfree = window.Cashfree;
    if (!Cashfree) {
      setSubmitting(false);
      setFailure("Payment SDK unavailable.");
      return;
    }
    const cashfree = Cashfree({
      mode: cf.mode === "production" ? "production" : "sandbox",
    });
    setModalOpen(true);
    let result: CashfreeCheckoutResult;
    try {
      result = await cashfree.checkout({
        paymentSessionId: cf.paymentSessionId,
        redirectTarget: "_modal",
      });
    } catch (e) {
      setSubmitting(false);
      setModalOpen(false);
      setFailure(e instanceof Error ? e.message : "Payment failed.");
      return;
    }
    if (result?.error) {
      setSubmitting(false);
      setModalOpen(false);
      setFailure(result.error.message ?? "Payment was not completed.");
      return;
    }
    try {
      await completeVerification(
        { order_id: createBody.order_id },
        createBody.order_id ?? "",
      );
    } catch (e) {
      setSubmitting(false);
      setModalOpen(false);
      setFailure(
        e instanceof Error
          ? `Payment may have gone through but we couldn't confirm it: ${e.message}`
          : "Couldn't confirm payment — contact support with your order id.",
      );
    }
  }

  async function onSubmit(values: FormValues) {
    setFailure(null);
    if (preview) {
      setFailure("Preview mode — checkout works on your published page.");
      return;
    }
    if (!razorpayReady) {
      setFailure("Checkout is still loading. Try again in a moment.");
      return;
    }
    if (pwyl && (!Number.isFinite(subtotal) || subtotal < pwylMin)) {
      setFailure(
        `Please choose an amount of at least ₹${pwylMin.toLocaleString("en-IN")}.`,
      );
      return;
    }
    // Name required for fixed-price templates; optional (derived) for pwyl.
    if (!nameOptional && (values.buyer_name?.trim().length ?? 0) < 2) {
      setFailure("Please enter your name.");
      return;
    }
    const buyerName = values.buyer_name?.trim() || nameFromEmail(values.buyer_email);
    if (gstOpen && gstinUpper && !gstinValid) {
      setFailure("The GSTIN you entered looks invalid. Check it or clear the field.");
      return;
    }
    setQuestionError(null);
    const missingQ = customQuestions.find(
      (q) => q.required && !(customAnswers[q.label]?.trim()),
    );
    if (missingQ) {
      setQuestionError(`Please answer: ${missingQ.label}`);
      return;
    }
    setShipError(null);
    if (props.requiresShipping) {
      if (!shipLine1.trim() || !shipCity.trim() || !shipPincode.trim()) {
        setShipError("Enter your delivery address (street, city and PIN code).");
        return;
      }
    }
    setSubmitting(true);
    maybePreCapture();

    let createBody: {
      ok?: boolean;
      gateway?: string;
      cashfree?: { paymentSessionId?: string; mode?: string };
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
          buyer_name: buyerName,
          buyer_phone: normalisePhone(values.buyer_phone),
          coupon_code: coupon?.code,
          bump_offered: bumpReady,
          bump_accepted: bumpReady && bumpAccepted,
          bump_product_id:
            bumpReady && bumpAccepted ? props.orderBump?.product_id : undefined,
          bump_amount: bumpReady && bumpAccepted ? bumpPrice : undefined,
          buyer_gstin: gstOpen && gstinUpper ? gstinUpper : undefined,
          buyer_state_code:
            gstOpen && gstinUpper
              ? stateCodeFromGstin(gstinUpper) ?? undefined
              : undefined,
          buyer_address: props.requiresShipping
            ? {
                line1: shipLine1 || undefined,
                line2: shipLine2 || undefined,
                city: shipCity || undefined,
                state_code: shipState || undefined,
                pincode: shipPincode || undefined,
              }
            : gstOpen && (billLine1 || billCity || billPincode)
              ? {
                  line1: billLine1 || undefined,
                  line2: billLine2 || undefined,
                  city: billCity || undefined,
                  state_code: stateCodeFromGstin(gstinUpper) ?? undefined,
                  pincode: billPincode || undefined,
                }
              : undefined,
          custom_fields: Object.keys(customAnswers).length ? customAnswers : undefined,
        }),
      });
      createBody = (await res.json()) as typeof createBody;
      if (!res.ok || !createBody.gateway) {
        throw new Error(createBody.error ?? "Couldn't start checkout");
      }
    } catch (err) {
      setSubmitting(false);
      setFailure(err instanceof Error ? err.message : String(err));
      return;
    }

    // Cashfree uses its own SDK + status-based confirmation.
    if (createBody.gateway === "cashfree") {
      await launchCashfree(createBody);
      return;
    }

    // Razorpay (default) — open Razorpay Checkout inline.
    if (!createBody.razorpay_order_id) {
      setSubmitting(false);
      setFailure("Couldn't start checkout");
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
        name: buyerName,
        email: values.buyer_email,
        contact: normalisePhone(values.buyer_phone),
      },
      notes: { invoxai_order_id: createBody.order_id ?? "" },
      theme: { color: primaryColor },
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

          // Show the success splash for ~700ms then redirect — gives the
          // buyer's eye time to land on the green check before navigation.
          stashBuyerLocally();
          setModalOpen(false);
          setSuccess(true);
          // Tell the exit guard payment is done so it doesn't warn "leave?"
          // on the redirect to the success page.
          window.dispatchEvent(new Event("invox:checkout-complete"));
          setTimeout(() => {
            window.location.href = verifyBody.redirect_url ?? "/";
          }, 700);
        } catch (e) {
          setSubmitting(false);
          setModalOpen(false);
          setFailure(
            e instanceof Error
              ? `Payment captured but verification failed: ${e.message}`
              : "Payment captured but verification failed — contact support with your payment id.",
          );
        }
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          setModalOpen(false);
        },
      },
    };

    const rzp = new window.Razorpay!(options);
    setModalOpen(true);
    rzp.open();
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (success) {
    return <SuccessSplash />;
  }

  // Field fragments — composed in different orders below. The pwyl card leads
  // with email + the price selector, then phone, then an optional name; the
  // fixed-price card keeps the classic name → email → phone order.
  const nameField = (
    <FormField
      control={form.control}
      name="buyer_name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold text-zinc-700">
            {nameOptional ? "Full name (optional)" : "Full name"}
          </FormLabel>
          <FormControl>
            <Input
              autoComplete="name"
              placeholder="Your name"
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const emailField = (
    <FormField
      control={form.control}
      name="buyer_email"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold text-zinc-700">
            Email
          </FormLabel>
          <FormControl>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...field}
              onBlur={() => {
                field.onBlur();
                // One tick later so RHF state is settled before the
                // pre-capture beacon reads form values.
                setTimeout(maybePreCapture, 0);
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const phoneField = (
    <FormField
      control={form.control}
      name="buyer_phone"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold text-zinc-700">
            Phone
          </FormLabel>
          <FormControl>
            <div className="relative">
              {/* +91 prefix shown as grey static text inside the field */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-zinc-400"
              >
                +91
              </span>
              <Input
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="98765 43210"
                className="pl-12"
                {...field}
                onChange={(e) => {
                  // Allow digits + spaces only; strip everything else
                  const cleaned = e.target.value.replace(/[^\d\s]/g, "");
                  field.onChange(cleaned);
                }}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const pwylBlock = pwyl ? (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Pay what you like
      </p>
      <div className="grid grid-cols-2 gap-2">
        {pwyl.presets.map((p) => {
          const active = !otherMode && chosenAmount === p.amount;
          return (
            <button
              key={p.amount}
              type="button"
              onClick={() => {
                setOtherMode(false);
                setChosenAmount(p.amount);
              }}
              style={
                active
                  ? { borderColor: primaryColor, background: `${primaryColor}1f` }
                  : undefined
              }
              className={cn(
                "relative flex min-h-[44px] items-center justify-center rounded-full border px-3 text-sm font-semibold transition",
                active
                  ? "text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
              )}
            >
              ₹{p.amount.toLocaleString("en-IN")}
              {p.label && (
                <span className="ml-1.5 text-[10px] font-normal text-zinc-500">
                  {p.label}
                </span>
              )}
              {p.popular && (
                <span
                  className="absolute -top-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                  style={{ background: primaryColor }}
                >
                  Popular
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOtherMode(true)}
          style={
            otherMode
              ? { borderColor: primaryColor, background: `${primaryColor}1f` }
              : undefined
          }
          className={cn(
            "flex min-h-[44px] items-center justify-center rounded-full border px-3 text-sm font-semibold transition",
            otherMode
              ? "text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
          )}
        >
          Other
        </button>
      </div>
      {otherMode && (
        <div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">
              ₹
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={pwylMin}
              placeholder={`Min ₹${pwylMin.toLocaleString("en-IN")}`}
              value={otherInput}
              onChange={(e) => {
                setOtherInput(e.target.value);
                const n = Number(e.target.value);
                setChosenAmount(Number.isFinite(n) ? n : 0);
              }}
              className="pl-7"
            />
          </div>
          {chosenAmount > 0 && chosenAmount < pwylMin && (
            <p className="mt-1 text-xs text-rose-600">
              Minimum is ₹{pwylMin.toLocaleString("en-IN")}.
            </p>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "relative space-y-3.5 transition-opacity duration-200",
        modalOpen && "pointer-events-none select-none opacity-50",
      )}
    >
      {/* Coupon-applied celebration — confetti + saved amount, auto-dismisses */}
      {celebrateSaved != null && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <style>{`@keyframes cpPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}@keyframes cpFall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(140px) rotate(380deg);opacity:0}}`}</style>
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${(i * 37) % 100}%`,
                top: "40%",
                width: 8,
                height: 12,
                borderRadius: 2,
                background: ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"][i % 5],
                animation: `cpFall ${0.9 + (i % 5) * 0.15}s ${(i % 5) * 0.05}s ease-in forwards`,
              }}
            />
          ))}
          <div
            className="rounded-2xl bg-white px-6 py-5 text-center"
            style={{ animation: "cpPop .35s ease-out both", boxShadow: `0 10px 44px ${primaryColor}55` }}
          >
            <div className="text-4xl">🎉</div>
            <div className="mt-1 font-sora text-lg font-bold text-zinc-900">Coupon applied!</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: primaryColor }}>
              You saved ₹{celebrateSaved.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      )}

      {/* Mini order summary (only when price > 0, fixed-price mode) */}
      {hasPrice && !pwyl && (
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {props.productImage ? (
            <img
              src={props.productImage}
              alt={props.productName}
              className="h-11 w-11 shrink-0 rounded-lg border border-zinc-200 object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 font-mono text-[10px] font-bold text-zinc-400"
            >
              IXA
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-sora text-sm font-semibold text-zinc-900">
              {props.productName}
            </p>
            {props.productDescription && (
              <p className="line-clamp-1 text-xs text-zinc-500">
                {props.productDescription}
              </p>
            )}
          </div>
          <p className="shrink-0 text-right font-mono text-base font-semibold text-zinc-900">
            ₹{subtotal.toLocaleString("en-IN")}
          </p>
        </div>
      )}

      {/* Failure banner */}
      {failure && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{failure}</div>
          <button
            type="button"
            onClick={() => setFailure(null)}
            aria-label="Dismiss"
            className="text-rose-700/70 hover:text-rose-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Form ── */}
      <Form {...form}>
        <form
          id="checkout-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3"
        >

          {/* Returning-customer login — pull saved details via email OTP */}
          {!preview && !recognized && (
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-white/10 bg-zinc-50/60 dark:bg-white/5 px-3 py-2 text-sm">
              {!rcOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setRcOpen(true);
                    setRcEmail(form.getValues("buyer_email") || "");
                  }}
                  className="font-medium text-zinc-700 dark:text-zinc-200 hover:underline"
                >
                  Returning customer?{" "}
                  <span style={{ color: primaryColor }}>Log in to auto-fill</span>
                </button>
              ) : (
                <div className="space-y-2">
                  {rcStage === "email" ? (
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Email you bought with"
                        value={rcEmail}
                        onChange={(e) => setRcEmail(e.target.value)}
                        disabled={rcBusy}
                      />
                      <Button
                        type="button"
                        onClick={rcSendCode}
                        disabled={rcBusy}
                        style={{ backgroundColor: primaryColor }}
                      >
                        {rcBusy ? "…" : "Send code"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        value={rcOtp}
                        onChange={(e) => setRcOtp(e.target.value)}
                        disabled={rcBusy}
                      />
                      <Button
                        type="button"
                        onClick={rcVerify}
                        disabled={rcBusy}
                        style={{ backgroundColor: primaryColor }}
                      >
                        {rcBusy ? "…" : "Verify"}
                      </Button>
                    </div>
                  )}
                  {rcMsg && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {rcMsg}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRcOpen(false);
                      setRcStage("email");
                      setRcOtp("");
                      setRcMsg(null);
                    }}
                    className="text-xs text-zinc-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {recognized && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Welcome back — we&apos;ve filled in your details.
            </p>
          )}

          {nameOptional ? (
            // pwyl card: email → price selector → phone → optional name
            <>
              {emailField}
              {pwylBlock}
              {phoneField}
              {nameField}
            </>
          ) : (
            // fixed-price card: classic name → email → phone
            <>
              {nameField}
              {emailField}
              {phoneField}
            </>
          )}

          {/* Seller-defined custom questions */}
          {customQuestions.length > 0 && (
            <div className="space-y-3">
              {customQuestions.map((q, i) => (
                <div key={i}>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    {q.label}
                    {q.required && <span className="text-rose-500"> *</span>}
                  </label>
                  <Input
                    value={customAnswers[q.label] ?? ""}
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({ ...prev, [q.label]: e.target.value }))
                    }
                    placeholder="Your answer"
                  />
                </div>
              ))}
              {questionError && <p className="text-sm text-rose-600">{questionError}</p>}
            </div>
          )}

          {/* Delivery address — physical products (Session 10) */}
          {props.requiresShipping && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium">Delivery address</p>
              <input
                value={shipLine1}
                onChange={(e) => setShipLine1(e.target.value)}
                placeholder="Street address"
                type="text"
                autoComplete="address-line1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={shipLine2}
                onChange={(e) => setShipLine2(e.target.value)}
                placeholder="Apartment, suite, etc. (optional)"
                type="text"
                autoComplete="address-line2"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={shipCity}
                  onChange={(e) => setShipCity(e.target.value)}
                  placeholder="City"
                  type="text"
                  autoComplete="address-level2"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  value={shipState}
                  onChange={(e) => setShipState(e.target.value)}
                  placeholder="State"
                  type="text"
                  autoComplete="address-level1"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <input
                value={shipPincode}
                onChange={(e) => setShipPincode(e.target.value)}
                placeholder="PIN code"
                inputMode="numeric"
                autoComplete="postal-code"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {shipError && <p className="text-sm text-rose-600">{shipError}</p>}
              <p className="text-xs text-muted-foreground">
                Shipping is added at checkout.
              </p>
            </div>
          )}

          {/* GSTIN collapsible */}
          <Collapsible
            open={gstOpen}
            onToggle={() => setGstOpen((v) => !v)}
            label={
              <>
                I have a GSTIN
                <span className="ml-1.5 text-[11px] font-normal text-zinc-400">
                  (business invoice)
                </span>
              </>
            }
          >
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-zinc-600">
                  GSTIN
                </label>
                <Input
                  placeholder="27ABCDE1234F1Z5"
                  value={buyerGstin}
                  maxLength={15}
                  onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
                {buyerGstin && !gstinValid && (
                  <p className="mt-1 text-xs text-rose-600">
                    Invalid GSTIN format.
                  </p>
                )}
              </div>
              <Input
                placeholder="Address line 1"
                value={billLine1}
                onChange={(e) => setBillLine1(e.target.value)}
              />
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
              <p className="text-xs text-zinc-500">
                We&apos;ll issue a B2B GST invoice with your GSTIN + billing
                address.
              </p>
            </div>
          </Collapsible>
        </form>
      </Form>

      {/* ── Coupon ── */}
      {hasPrice && (
        <Collapsible
          open={couponOpen || !!coupon}
          onToggle={() => setCouponOpen((v) => !v)}
          label={
            coupon ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Coupon applied — {coupon.code}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Have a coupon? Apply
              </span>
            )
          }
          collapsibleWhenLocked={!coupon}
        >
          <div className="space-y-2 pt-2">
            {coupon ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-emerald-800">
                  <Check className="h-4 w-4" />
                  {coupon.code} — ₹
                  {coupon.discount_amount.toLocaleString("en-IN")} off
                </span>
                <button
                  type="button"
                  className="text-emerald-700/70 hover:text-emerald-700"
                  onClick={clearCoupon}
                  aria-label="Remove coupon"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="COUPON CODE"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    disabled={applyingCoupon}
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyCoupon()}
                    disabled={applyingCoupon || !couponInput.trim()}
                  >
                    {applyingCoupon ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-rose-600">{couponError}</p>
                )}
                {availCoupons.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-medium text-zinc-500">
                      Available offers — tap to apply
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availCoupons.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => applyCoupon(c.code)}
                          disabled={applyingCoupon}
                          title={c.min_order > 0 ? `Min order ₹${c.min_order}` : undefined}
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-emerald-400/70 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <span className="font-mono font-semibold">{c.code}</span>
                          <span className="opacity-80">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Collapsible>
      )}

      {/* ── Order Bump ── */}
      {bumpReady && props.orderBump && (
        <OrderBump
          config={props.orderBump}
          checked={bumpAccepted}
          onChange={setBumpAccepted}
        />
      )}

      {/* ── Price summary ── */}
      {hasPrice && (
        <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
          <Row
            label="Subtotal"
            value={`₹${subtotal.toLocaleString("en-IN")}`}
          />
          {discount > 0 && (
            <Row
              label={`Discount (${coupon?.code ?? "coupon"})`}
              value={`-₹${discount.toLocaleString("en-IN")}`}
              accent="emerald"
            />
          )}
          {bumpExtra > 0 && (
            <Row
              label={`+ ${props.orderBump?.title ?? "Bonus"}`}
              value={`+₹${bumpExtra.toLocaleString("en-IN")}`}
              accent="amber"
            />
          )}
          <div className="mt-1.5 flex items-baseline justify-between border-t border-zinc-200 pt-2">
            <span className="text-sm font-medium text-zinc-700">Total</span>
            <span className="font-sora text-xl font-bold text-zinc-900">
              ₹{total.toLocaleString("en-IN")}
              <span className="ml-1 text-[11px] font-normal text-zinc-500">
                {currency}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── Pay button — sticky bottom bar on mobile when stickyPay ── */}
      <div
        className={cn(
          props.stickyPay && [
            // Mobile: fixed action bar pinned to the bottom of the viewport
            // with a safe-area inset for iOS home indicators.
            "fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 pt-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur",
            "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
            // Desktop: revert to a normal inline button (no bar chrome).
            "md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
          ],
        )}
      >
        <button
          type="submit"
          form="checkout-form"
          disabled={submitting || !razorpayReady}
          style={{ background: primaryColor }}
          className={cn(
            "btn-shine group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-md transition",
            "hover:brightness-110 active:brightness-95",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              {payLabel ??
                (hasPrice
                  ? `Pay ₹${total.toLocaleString("en-IN")} securely`
                  : "Complete order")}
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Trust strip — one compact, polished line ── */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 pt-0.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500">
          <Lock className="h-3 w-3" />
          SSL secured
        </span>
        <span className="text-zinc-300">·</span>
        <div className="flex items-center gap-1">
          {["UPI", "Visa", "Mastercard", "RuPay"].map((m) => (
            <span
              key={m}
              className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-600"
            >
              {m}
            </span>
          ))}
        </div>
        <span className="text-zinc-300">·</span>
        <span className="text-[11px] font-medium text-zinc-500">Razorpay</span>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-600">{label}</span>
      <span
        className={cn(
          "font-mono",
          accent === "emerald" && "text-emerald-700",
          accent === "amber" && "text-amber-700",
          !accent && "text-zinc-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Collapsible({
  open,
  onToggle,
  label,
  children,
  collapsibleWhenLocked = true,
}: {
  open: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  children: React.ReactNode;
  /** When false the chevron rotates but the toggle handler is suppressed
   *  (used when a coupon is applied — clicking the header just shows the
   *  state, not a re-open). */
  collapsibleWhenLocked?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60">
      <button
        type="button"
        onClick={collapsibleWhenLocked ? onToggle : undefined}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-zinc-800"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">{label}</span>
        {collapsibleWhenLocked && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        )}
      </button>
      {/* Smooth height transition via grid-rows trick — no measurement, no JS. */}
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SuccessSplash() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
        style={{
          animation: "ixaScaleIn 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <CheckCircle2 className="h-8 w-8" />
      </span>
      <h3 className="font-sora text-xl font-bold tracking-tight text-zinc-900">
        Payment successful!
      </h3>
      <p className="text-sm text-zinc-500">Redirecting to your order…</p>
      <style jsx>{`
        @keyframes ixaScaleIn {
          0% {
            opacity: 0;
            transform: scale(0.4);
          }
          60% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/** Derive a human receipt name from an email's local part when the buyer
 *  leaves the (optional) name field blank — e.g. "rahul.k@x.com" → "Rahul K". */
function nameFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  if (!local) return "Customer";
  return local
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalisePhone(raw: string): string {
  // Strip non-digits and prepend +91 if the result looks like a 10-digit
  // Indian mobile. Otherwise return as-is — the API does its own parsing
  // for international numbers.
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (raw.startsWith("+")) return raw;
  return digits;
}
