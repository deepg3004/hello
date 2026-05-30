"use client";

import {
  ArrowRight,
  Check,
  Download,
  Lock,
  Package,
  Sparkles,
  Zap,
} from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type { BaseTemplateProps } from "./shared/types";

interface Feature {
  text: string;
}

export interface PaymentDigitalProductPageProps extends BaseTemplateProps {
  mockup_url?: string;
  /** Optional small badge above the headline (e.g. "🚀 New release"). */
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  features_title?: string;
  features_items?: Feature[];
  price_card_title?: string;
  price_card_note?: string;
  /** Strikethrough original price (e.g. ₹1499 → ₹999). Optional. */
  original_price?: number;
}

// Subtle icon rotation for the feature grid.
const FEATURE_ICONS = [Zap, Package, Sparkles, Download, Check];

export function PaymentDigitalProductPage(
  props: PaymentDigitalProductPageProps,
) {
  const features = props.features_items ?? [];
  const price = Number(props.product?.price ?? 0);
  const original = props.original_price ?? 0;
  const hasDiscount = original > price && price > 0;
  const heroCta = props.hero_cta ?? "Get instant access";

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* =====================================================================
          HERO — full-width centered mockup + headline above
          ===================================================================== */}
      <section className="relative isolate overflow-hidden border-b border-zinc-100">
        {/* Soft ambient indigo wash behind mockup */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
          style={{
            background:
              "radial-gradient(60% 80% at 50% 0%, rgba(99, 102, 241, 0.10) 0%, rgba(255,255,255,0) 70%)",
          }}
        />

        <div className="mx-auto max-w-5xl px-4 pb-16 pt-16 text-center md:pb-20 md:pt-20">
          {props.hero_eyebrow && (
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3 w-3" />
              {props.hero_eyebrow}
            </span>
          )}

          <h1 className="mx-auto max-w-3xl font-sora text-[40px] font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            {props.hero_headline}
          </h1>

          {props.hero_subheadline && (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg md:text-xl">
              {props.hero_subheadline}
            </p>
          )}

          <a
            href="#buy"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:scale-105 hover:bg-indigo-700"
          >
            {heroCta}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </a>

          {/* Trust strip */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Instant download
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Secure payment
            </span>
            <span className="opacity-40">•</span>
            <span>📱 UPI accepted</span>
          </div>

          {/* Product mockup — centered, large, with subtle frame */}
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-2 shadow-xl shadow-indigo-900/5 md:p-3">
              <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-zinc-100">
                {props.mockup_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={props.mockup_url}
                    alt={props.hero_headline}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12) 60%, rgba(244,245,248,1))",
                    }}
                  >
                    <span className="font-sora text-2xl font-semibold text-indigo-400/60">
                      Product mockup
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          FEATURES — 2-col icon grid
          ===================================================================== */}
      {features.length > 0 && (
        <section className="border-b border-zinc-100 bg-white py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4">
            {props.features_title && (
              <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {props.features_title}
              </h2>
            )}
            <ul className="mx-auto mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((f, i) => {
                const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length] ?? Check;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-sm"
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <p className="text-base font-medium leading-snug text-zinc-900">
                      {f.text}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* =====================================================================
          PRICE CARD — minimal, centered, optional strikethrough original
          ===================================================================== */}
      <section
        id="buy"
        className="scroll-mt-8 bg-zinc-50 px-4 pb-32 pt-16 md:pb-20"
      >
        <div className="mx-auto max-w-md">
          {props.price_card_title && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              {props.price_card_title}
            </h2>
          )}
          {props.price_card_note && (
            <p className="mt-2 text-center text-sm text-zinc-500">
              {props.price_card_note}
            </p>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            {/* Price header — gradient strip */}
            <div className="border-b border-zinc-100 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 px-6 py-5 text-center">
              {hasDiscount && (
                <div className="mb-1 flex items-center justify-center gap-2">
                  <span className="text-base text-zinc-400 line-through">
                    ₹{original.toLocaleString("en-IN")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    Save{" "}
                    {Math.round(((original - price) / original) * 100)}%
                  </span>
                </div>
              )}
              <div className="font-sora text-5xl font-bold tracking-tight text-zinc-900">
                ₹{price.toLocaleString("en-IN")}
              </div>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
                One-time payment · Instant download
              </p>
            </div>

            {/* Checkout form */}
            <div className="p-6">
              {props.pageId && props.product && !props.isPreview ? (
                <CheckoutForm
                  pageId={props.pageId}
                  productId={props.product.id}
                  productName={props.product.name}
                  productDescription={props.product.description}
                  productImage={props.product.image_url}
                  price={Number(props.product.price)}
                  currency={props.product.currency}
                  orderBump={
                    props.bumpRuntime
                      ? { ...props.bumpRuntime, ready: true }
                      : undefined
                  }
                />
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                  {props.isPreview
                    ? "Checkout form renders on the live page."
                    : "Attach a product to this page to enable checkout."}
                </p>
              )}
            </div>

            {/* Security strip */}
            <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                <Lock className="h-3 w-3" />
                SSL Encrypted · Powered by Razorpay
              </p>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {["UPI", "Visa", "Mastercard", "RuPay"].map((m) => (
                  <span
                    key={m}
                    className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <StickyCheckoutBar
        targetId="buy"
        priceLabel={price ? `₹${price.toLocaleString("en-IN")}` : "Buy"}
        cta={heroCta}
        buttonClassName="bg-indigo-600 text-white"
      />
    </div>
  );
}
