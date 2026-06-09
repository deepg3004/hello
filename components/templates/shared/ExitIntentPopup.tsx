"use client";

import { useEffect, useState } from "react";
import { Copy, X } from "lucide-react";

import type { ExitIntentConfig } from "@/lib/conversion";
import { resolvedExitIntent } from "@/lib/conversion";

interface ExitIntentPopupProps {
  pageSlug: string;
  config: ExitIntentConfig;
  isPreview?: boolean;
}

const COOKIE_DAYS_MAX = 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

function writeCookie(name: string, value: string, hours: number) {
  if (typeof document === "undefined") return;
  const days = Math.min(COOKIE_DAYS_MAX, Math.max(1 / 24, hours / 24));
  const exp = new Date(Date.now() + days * 86_400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/`;
}

export function ExitIntentPopup({ pageSlug, config, isPreview }: ExitIntentPopupProps) {
  const cfg = resolvedExitIntent(config);
  const [open, setOpen] = useState(false);
  const cookieKey = `exit_shown_${pageSlug}`;

  useEffect(() => {
    if (!cfg.enabled) return;
    if (isPreview) return;
    if (readCookie(cookieKey)) return;

    let armed = false;
    let bound = false;

    const arm = () => {
      armed = true;
      bindListeners();
    };
    const onMouseLeave = (e: MouseEvent) => {
      if (!armed) return;
      if (e.clientY < 10) trigger();
    };
    const onScroll = () => {
      if (!armed) return;
      // Mobile: trigger when the user scrolls back up quickly near the top.
      if (window.scrollY < 100 && lastScrollY.current > 600) trigger();
      lastScrollY.current = window.scrollY;
    };
    const lastScrollY = { current: 0 };
    const bindListeners = () => {
      if (bound) return;
      bound = true;
      document.addEventListener("mouseleave", onMouseLeave);
      window.addEventListener("scroll", onScroll, { passive: true });
    };
    const unbindListeners = () => {
      if (!bound) return;
      bound = false;
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
    const trigger = () => {
      unbindListeners();
      setOpen(true);
      writeCookie(cookieKey, "1", cfg.suppress_hours ?? 24);
    };

    const armId = setTimeout(arm, (cfg.min_time_seconds ?? 10) * 1000);
    return () => {
      clearTimeout(armId);
      unbindListeners();
    };
  }, [cfg, isPreview, cookieKey]);

  if (!cfg.enabled || isPreview || !open) return null;

  function dismiss() {
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-white p-6 text-zinc-900 shadow-2xl animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-balance text-xl font-semibold">{cfg.headline}</h2>
        {cfg.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{cfg.body}</p>
        )}

        {cfg.action === "show_coupon" && cfg.coupon_code && (
          <CouponBlock code={cfg.coupon_code} description={cfg.coupon_description} pageSlug={pageSlug} />
        )}

        {cfg.action === "show_message" && cfg.cta_text && (
          cfg.cta_url ? (
            <a
              href={cfg.cta_url}
              className="mt-5 inline-block rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
              onClick={dismiss}
            >
              {cfg.cta_text}
            </a>
          ) : (
            // No destination configured — make the CTA close the popup rather
            // than render a dead "#" link.
            <button
              type="button"
              onClick={dismiss}
              className="mt-5 inline-block rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              {cfg.cta_text}
            </button>
          )
        )}

        {/* show_form is not implemented yet — render nothing (headline/body still
            show) instead of leaking a dev note to buyers. */}
      </div>
    </div>
  );
}

function CouponBlock({
  code,
  description,
  pageSlug,
}: {
  code: string;
  description?: string;
  pageSlug: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      // Make the code available to CheckoutForm so it can auto-apply.
      sessionStorage.setItem(`invoxai_coupon_${pageSlug}`, code);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may fail in some browsers */
    }
  }
  return (
    <div className="mt-4 space-y-2">
      {description && <p className="text-sm text-zinc-600">{description}</p>}
      <div className="flex items-center gap-2 rounded-md border border-dashed bg-zinc-50 p-3">
        <code className="flex-1 select-all font-mono text-lg font-semibold">{code}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Paste at checkout. We&apos;ll also try to apply it automatically.
      </p>
    </div>
  );
}
