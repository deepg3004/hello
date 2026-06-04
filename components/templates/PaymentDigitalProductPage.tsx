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
import { BgAnimation } from "./BgAnimation";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { tgTheme } from "@/lib/telegram-themes";
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
  /** Theme key (see lib/telegram-themes). Defaults to "emerald". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
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
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      {/* =====================================================================
          HERO — full-width centered mockup + headline above
          ===================================================================== */}
      <section className="relative isolate z-10 overflow-hidden border-b border-white/10">
        {/* Soft ambient accent wash behind mockup */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
          style={{
            background: `radial-gradient(60% 80% at 50% 0%, ${accent}26 0%, transparent 70%)`,
          }}
        />

        <div className="mx-auto max-w-5xl px-4 pb-16 pt-16 text-center md:pb-20 md:pt-20">
          {props.hero_eyebrow && (
            <span
              className="mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: `${accent}66`,
                backgroundColor: `${accent}26`,
                color: accent,
              }}
            >
              <Sparkles className="h-3 w-3" />
              {props.hero_eyebrow}
            </span>
          )}

          <h1 className="mx-auto max-w-3xl font-sora text-[40px] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {props.hero_headline}
          </h1>

          {props.hero_subheadline && (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
              {props.hero_subheadline}
            </p>
          )}

          <a
            href="#buy"
            style={{ backgroundColor: accent, boxShadow: `0 10px 25px -5px ${accent}66` }}
            className="mt-7 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition hover:scale-105 hover:opacity-90"
          >
            {heroCta}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </a>

          {/* Trust strip */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
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
            <div
              className="rounded-3xl border border-white/10 p-2 shadow-2xl md:p-3"
              style={{ backgroundColor: theme.card }}
            >
              <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black/30">
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
                      background: `linear-gradient(135deg, ${accent}33, ${accent}14 60%, rgba(0,0,0,0.2))`,
                    }}
                  >
                    <span
                      className="font-sora text-2xl font-semibold"
                      style={{ color: `${accent}99` }}
                    >
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
        <section className="relative z-10 border-b border-white/10 py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4">
            {props.features_title && (
              <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {props.features_title}
              </h2>
            )}
            <ul className="mx-auto mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((f, i) => {
                const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length] ?? Check;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-4 rounded-xl border border-white/10 p-5 transition hover:border-white/25"
                    style={{ backgroundColor: theme.card }}
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${accent}26`, color: accent }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <p className="text-base font-medium leading-snug text-zinc-100">
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
        className="relative z-10 scroll-mt-8 px-4 pb-32 pt-16 md:pb-20"
      >
        <div className="mx-auto max-w-md">
          {props.price_card_title && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {props.price_card_title}
            </h2>
          )}
          {props.price_card_note && (
            <p className="mt-2 text-center text-sm text-zinc-400">
              {props.price_card_note}
            </p>
          )}

          <div
            className="mt-6 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{ backgroundColor: theme.card }}
          >
            {/* Price header — accent strip */}
            <div
              className="border-b border-white/10 px-6 py-5 text-center"
              style={{
                background: `linear-gradient(90deg, ${accent}26, transparent 50%, ${accent}26)`,
              }}
            >
              {hasDiscount && (
                <div className="mb-1 flex items-center justify-center gap-2">
                  <span className="text-base text-zinc-400 line-through">
                    ₹{original.toLocaleString("en-IN")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-300">
                    Save{" "}
                    {Math.round(((original - price) / original) * 100)}%
                  </span>
                </div>
              )}
              <div className="font-sora text-5xl font-bold tracking-tight text-white">
                ₹{price.toLocaleString("en-IN")}
              </div>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-400">
                One-time payment · Instant download
              </p>
            </div>

            {/* Checkout form */}
            <div className="p-6">
              {props.product ? (
                <CheckoutForm
                  pageId={props.pageId ?? "preview"}
                  preview={props.isPreview}
                  productId={props.product.id}
                  requiresShipping={!!props.product.requires_shipping}
                  productName={props.product.name}
                  productDescription={props.product.description}
                  productImage={props.product.image_url}
                  price={Number(props.product.price)}
                  currency={props.product.currency}
                  primaryColor={accent}
                  orderBump={
                    props.bumpRuntime
                      ? { ...props.bumpRuntime, ready: true }
                      : undefined
                  }
                />
              ) : (
                <p className="rounded-lg border border-dashed border-white/20 bg-black/20 p-4 text-center text-sm text-zinc-400">
                  {props.isPreview
                    ? "Checkout form renders on the live page."
                    : "Attach a product to this page to enable checkout."}
                </p>
              )}
            </div>

            {/* Security strip */}
            <div className="bg-black/20 px-6 pb-4">
              <SecureFooter accent={accent} />
            </div>
          </div>
        </div>
      </section>

      <StickyCheckoutBar
        targetId="buy"
        priceLabel={price ? `₹${price.toLocaleString("en-IN")}` : "Buy"}
        cta={heroCta}
        buttonClassName="text-white"
        buttonStyle={{ backgroundColor: accent }}
        barClassName="border-t border-white/10"
        barStyle={{ backgroundColor: theme.card }}
      />
    </div>
  );
}
