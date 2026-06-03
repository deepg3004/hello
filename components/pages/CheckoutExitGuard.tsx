"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

/**
 * Razorpay-style "are you sure you want to leave?" guard for the checkout page.
 * Traps the browser Back button (shows a custom modal instead of navigating
 * away) and warns on tab close / reload via beforeunload. Works on mobile —
 * the back gesture/button triggers the same modal.
 */
export function CheckoutExitGuard({
  backHref,
  amountLabel,
}: {
  backHref?: string | null;
  amountLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // Payment succeeded → disarm everything so the redirect to the success
    // page goes straight through with no "leave?" prompt.
    const onComplete = () => {
      leaving.current = true;
      setOpen(false);
    };
    window.addEventListener("invox:checkout-complete", onComplete);

    // Push a sentinel entry so the first Back press fires popstate while
    // keeping the user on the page. IMPORTANT: clone the CURRENT history.state
    // (Next.js App Router stores its router state there) so the back press
    // doesn't trigger Next's hard-resync navigation — that's what stopped the
    // modal from showing on desktop. We re-push on each pop to stay trapped.
    const seed = () =>
      window.history.pushState(window.history.state, "", window.location.href);
    seed();
    const onPop = () => {
      if (leaving.current) return;
      seed();
      setOpen(true);
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("invox:checkout-complete", onComplete);
    };
  }, []);

  function leave() {
    leaving.current = true;
    setOpen(false);
    if (backHref) window.location.href = backHref;
    else window.history.go(-1);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="relative px-6 pb-2 pt-7 text-center">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">🛑</span>
          </div>
          <h2 className="mt-4 font-sora text-lg font-bold text-zinc-900">
            Leave without paying?
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600">
            Your order{amountLabel ? ` of ${amountLabel}` : ""} isn&apos;t
            complete yet. You&apos;re just one step away — don&apos;t lose it!
          </p>
        </div>

        <div className="flex flex-col gap-2 px-6 pb-6 pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-shine flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" />
            Resume my payment
          </button>
          <button
            type="button"
            onClick={leave}
            className="w-full rounded-xl py-3 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            No thanks, leave anyway
          </button>
        </div>
      </div>
    </div>
  );
}
