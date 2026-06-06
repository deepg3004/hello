"use client";

// =============================================================================
// Shared buyer-side checkout launcher for ALL seller-gateway flows (product
// page, store/cart, one-time-offer, bookings, events). Given the create-order
// response, it opens the right provider's checkout (Razorpay popup OR Cashfree
// SDK modal), then POSTs the flow's verify endpoint and reports the result.
//
// This keeps every flow gateway-agnostic: add a provider once here + in the
// drivers, and every checkout supports it. Window globals are accessed via
// casts so this doesn't fight other modules' `declare global` blocks.
// =============================================================================

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";
const CASHFREE_SDK = "https://sdk.cashfree.com/js/v3/cashfree.js";

interface RazorpayCtor {
  new (options: Record<string, unknown>): { open: () => void };
}
interface CashfreeFn {
  (opts: { mode: "sandbox" | "production" }): {
    checkout: (o: {
      paymentSessionId: string;
      redirectTarget?: string;
    }) => Promise<{ error?: { message?: string } }>;
  };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(s);
  });
}

export interface CreateOrderResponse {
  ok?: boolean;
  gateway?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  razorpay_order_id?: string;
  key?: string;
  cashfree?: { paymentSessionId?: string; mode?: string };
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  error?: string;
}

export interface LaunchHandlers {
  /** Endpoint that finalizes this flow's order, e.g. /api/checkout/verify-cart-payment. */
  verifyUrl: string;
  /** Extra fields this flow's verify route needs beyond order_id / razorpay_*. */
  verifyExtra?: Record<string, unknown>;
  prefill?: { name?: string; email?: string; phone?: string };
  themeColor?: string;
  onSuccess: (result: { redirect_url?: string }) => void;
  onError: (message: string) => void;
  onDismiss?: () => void;
}

async function runVerify(
  body: Record<string, unknown>,
  h: LaunchHandlers,
): Promise<void> {
  const res = await fetch(h.verifyUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    redirect_url?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Verification failed");
  }
  h.onSuccess({ redirect_url: data.redirect_url });
}

function launchRazorpay(res: CreateOrderResponse, h: LaunchHandlers): void {
  const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (!Razorpay || !res.razorpay_order_id) {
    h.onError("Couldn't start checkout.");
    return;
  }
  const rzp = new Razorpay({
    key: res.key,
    amount: res.amount,
    currency: res.currency ?? "INR",
    name: res.name ?? "InvoxAI",
    description: res.description,
    order_id: res.razorpay_order_id,
    prefill: {
      name: h.prefill?.name,
      email: h.prefill?.email,
      contact: h.prefill?.phone,
    },
    notes: { invoxai_order_id: res.order_id ?? "" },
    theme: { color: h.themeColor ?? "#4F46E5" },
    handler: async (r: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      try {
        await runVerify(
          {
            razorpay_order_id: r.razorpay_order_id,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature: r.razorpay_signature,
            order_id: res.order_id,
            ...h.verifyExtra,
          },
          h,
        );
      } catch (e) {
        h.onError(
          e instanceof Error
            ? `Payment captured but verification failed: ${e.message}`
            : "Payment captured but verification failed — contact support.",
        );
      }
    },
    modal: { ondismiss: () => h.onDismiss?.() },
  });
  rzp.open();
}

async function launchCashfree(
  res: CreateOrderResponse,
  h: LaunchHandlers,
): Promise<void> {
  const cf = res.cashfree;
  if (!cf?.paymentSessionId) {
    h.onError("Couldn't start Cashfree checkout.");
    return;
  }
  if (!(window as unknown as { Cashfree?: CashfreeFn }).Cashfree) {
    try {
      await loadScript(CASHFREE_SDK);
    } catch {
      h.onError("Couldn't load the payment SDK. Refresh and try again.");
      return;
    }
  }
  const Cashfree = (window as unknown as { Cashfree?: CashfreeFn }).Cashfree;
  if (!Cashfree) {
    h.onError("Payment SDK unavailable.");
    return;
  }
  const cashfree = Cashfree({
    mode: cf.mode === "production" ? "production" : "sandbox",
  });
  let result: { error?: { message?: string } };
  try {
    result = await cashfree.checkout({
      paymentSessionId: cf.paymentSessionId,
      redirectTarget: "_modal",
    });
  } catch (e) {
    h.onError(e instanceof Error ? e.message : "Payment failed.");
    return;
  }
  if (result?.error) {
    h.onError(result.error.message ?? "Payment was not completed.");
    return;
  }
  try {
    await runVerify({ order_id: res.order_id, ...h.verifyExtra }, h);
  } catch (e) {
    h.onError(
      e instanceof Error
        ? `Payment may have gone through but we couldn't confirm it: ${e.message}`
        : "Couldn't confirm payment — contact support with your order id.",
    );
  }
}

/** Launch the right provider's checkout for a create-order response. */
export async function launchCheckout(
  res: CreateOrderResponse,
  h: LaunchHandlers,
): Promise<void> {
  // Ensure the Razorpay SDK is present. Skip loading when it's already on the
  // page — some flows preload it via their own hook, and waiting on a `load`
  // event that already fired would hang forever (Razorpay would never open).
  if (res.gateway !== "cashfree") {
    if (!(window as unknown as { Razorpay?: RazorpayCtor }).Razorpay) {
      try {
        await loadScript(RAZORPAY_SDK);
      } catch {
        h.onError("Couldn't load the payment SDK. Refresh and try again.");
        return;
      }
    }
    launchRazorpay(res, h);
    return;
  }
  await launchCashfree(res, h);
}
