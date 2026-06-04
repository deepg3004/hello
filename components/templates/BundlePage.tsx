"use client";

import {
  ArrowRight,
  Check,
  Gift,
  Layers,
  Package,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { BgAnimation } from "./BgAnimation";
import { Stars } from "./shared/Stars";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import type { BaseTemplateProps } from "./shared/types";
import { tgTheme } from "@/lib/telegram-themes";

interface ValueStackItem {
  /** Name of the included item / asset. */
  name: string;
  /** Individual worth, shown crossed-out (e.g. "₹2,999"). */
  worth?: string;
}
interface BundleItem {
  title: string;
  description?: string;
}
interface BundleTestimonial {
  quote: string;
  author: string;
  role?: string;
}

export interface BundlePageProps extends BaseTemplateProps {
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;

  stack_title?: string;
  stack_subtitle?: string;
  stack_items?: ValueStackItem[];
  stack_total_label?: string;
  stack_total_value?: string;
  stack_total_yours?: string;

  inside_title?: string;
  inside_subtitle?: string;
  inside_items?: BundleItem[];

  proof_title?: string;
  testimonials_items?: BundleTestimonial[];

  checkout_title?: string;
  checkout_billing_note?: string;
  checkout_features_title?: string;
  checkout_features?: BundleItem[];
  checkout_guarantee?: string;

  /** Theme key (see lib/telegram-themes). Defaults to "gold". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

const FALLBACK_PRICE = 1999;

export function BundlePage(props: BundlePageProps) {
  const stackItems = props.stack_items ?? [];
  const insideItems = props.inside_items ?? [];
  const testimonials = props.testimonials_items ?? [];
  const features = props.checkout_features ?? [];

  const productName = props.product?.name ?? "The Complete Bundle";
  const productPrice = props.product?.price ?? FALLBACK_PRICE;
  const productCurrency = props.product?.currency ?? "INR";

  const heroCta = props.hero_cta ?? "Get the bundle";

  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      {/* =====================================================================
          HERO — centered mega-deal pitch: eyebrow + headline + subhead + CTA.
          ===================================================================== */}
      <section className="relative isolate z-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-12%] h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}26` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-20 text-center md:pb-16 md:pt-28">
          {props.hero_eyebrow && (
            <span
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-white"
              style={{
                borderColor: `${accent}4d`,
                backgroundColor: `${accent}1a`,
              }}
            >
              <Gift className="h-3.5 w-3.5" style={{ color: accent }} />
              {props.hero_eyebrow}
            </span>
          )}

          <h1 className="font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {props.hero_headline}
          </h1>

          {props.hero_subheadline && (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
              {props.hero_subheadline}
            </p>
          )}

          <a
            href="#get"
            style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accent}40` }}
            className="mt-8 inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-semibold text-white transition hover:scale-105 hover:opacity-90 sm:px-11 sm:text-lg"
          >
            {heroCta}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </a>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/60 md:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Everything in one bundle
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Instant access
            </span>
            <span className="opacity-40">•</span>
            <span>📱 UPI accepted</span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MAIN — content left, sticky checkout right at lg.
          ===================================================================== */}
      <div className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
            {/* ── LEFT (content) ─────────────────────────────────────── */}
            <div className="space-y-10 lg:col-span-2 lg:space-y-14">
              {/* Everything you get — VALUE STACK */}
              {(stackItems.length > 0 ||
                props.stack_total_value ||
                props.stack_total_yours) && (
                <section>
                  {props.stack_title && (
                    <h2 className="font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {props.stack_title}
                    </h2>
                  )}
                  {props.stack_subtitle && (
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {props.stack_subtitle}
                    </p>
                  )}

                  {stackItems.length > 0 && (
                    <ul className="mt-6 space-y-2.5">
                      {stackItems.map((it, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                          style={{ backgroundColor: theme.card }}
                        >
                          <span
                            aria-hidden
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: accent }}
                          >
                            <Check className="h-4 w-4" strokeWidth={2.5} />
                          </span>
                          <span className="min-w-0 flex-1 font-sora text-sm font-semibold text-white sm:text-base">
                            {it.name}
                          </span>
                          {it.worth && (
                            <span className="shrink-0 text-sm font-semibold text-zinc-500 line-through">
                              {it.worth}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Big total-value reveal */}
                  {(props.stack_total_value || props.stack_total_yours) && (
                    <div
                      className="mt-6 overflow-hidden rounded-2xl border p-6 text-center shadow-xl md:p-8"
                      style={{
                        borderColor: `${accent}59`,
                        background: `linear-gradient(135deg, ${accent}26, ${accent}0d 70%, ${theme.card})`,
                      }}
                    >
                      {props.stack_total_label && (
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: accent }}
                        >
                          {props.stack_total_label}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                        {props.stack_total_value && (
                          <span className="font-sora text-xl font-semibold text-zinc-400 line-through sm:text-2xl">
                            {props.stack_total_value}
                          </span>
                        )}
                        {props.stack_total_yours && (
                          <span className="font-sora text-3xl font-bold text-white sm:text-4xl">
                            {props.stack_total_yours}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* What's inside the bundle — grid */}
              {insideItems.length > 0 && (
                <section>
                  {props.inside_title && (
                    <h2 className="font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {props.inside_title}
                    </h2>
                  )}
                  {props.inside_subtitle && (
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {props.inside_subtitle}
                    </p>
                  )}
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {insideItems.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-white/10 p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                        style={{ backgroundColor: theme.card }}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: `${accent}26` }}
                        >
                          <Package className="h-4 w-4" style={{ color: accent }} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-sora text-sm font-semibold text-white">
                            {it.title}
                          </p>
                          {it.description && (
                            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                              {it.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Testimonials strip */}
              {testimonials.length > 0 && (
                <section
                  className="overflow-hidden rounded-2xl border border-white/10 px-5 py-8 shadow-lg md:px-8 md:py-10"
                  style={{ backgroundColor: theme.card }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Stars rating={5} className="text-amber-400" />
                    {props.proof_title && (
                      <h2 className="font-sora text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {props.proof_title}
                      </h2>
                    )}
                  </div>

                  <div className="-mx-2 mt-6 flex gap-4 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {testimonials.map((t, i) => (
                      <figure
                        key={i}
                        className="min-w-[260px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur md:min-w-0"
                      >
                        <Star
                          className="mb-2 h-4 w-4 text-amber-400"
                          fill="currentColor"
                        />
                        <blockquote className="text-sm leading-relaxed text-white/90">
                          &ldquo;{t.quote}&rdquo;
                        </blockquote>
                        <figcaption className="mt-4 flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: accent }}
                          >
                            {initials(t.author)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {t.author}
                            </div>
                            {t.role && (
                              <div className="truncate text-xs text-white/60">
                                {t.role}
                              </div>
                            )}
                          </div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── RIGHT (sticky checkout) ────────────────────────────── */}
            <aside
              id="get"
              className="scroll-mt-8 lg:col-span-1 lg:sticky lg:top-8 lg:self-start"
            >
              <div
                className="rounded-2xl border p-6 shadow-2xl"
                style={{
                  backgroundColor: theme.card,
                  borderColor: `${accent}33`,
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white"
                  style={{ backgroundColor: `${accent}26` }}
                >
                  <Sparkles className="h-3 w-3" style={{ color: accent }} />
                  {props.hero_eyebrow ?? "Limited bundle"}
                </span>

                {props.checkout_title && (
                  <h3 className="mt-3 font-sora text-xl font-bold tracking-tight text-white">
                    {props.checkout_title}
                  </h3>
                )}
                <p className="mt-1 truncate text-sm text-zinc-400">
                  {productName}
                </p>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-sora text-4xl font-bold text-white">
                    ₹{Number(productPrice).toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {props.checkout_billing_note ??
                      (productCurrency === "INR" ? "one-time" : productCurrency)}
                  </span>
                </div>

                {props.stack_total_value && (
                  <p className="mt-1 text-sm text-zinc-400">
                    Total value{" "}
                    <span className="font-semibold text-zinc-500 line-through">
                      {props.stack_total_value}
                    </span>
                  </p>
                )}

                {features.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    {props.checkout_features_title && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {props.checkout_features_title}
                      </p>
                    )}
                    <ul className="mt-2 space-y-1.5">
                      {features.slice(0, 6).map((it, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-zinc-300"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          <span>{it.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Checkout form */}
                <div className="mt-5">
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
                      orderBump={
                        props.bumpRuntime
                          ? { ...props.bumpRuntime, ready: true }
                          : undefined
                      }
                      primaryColor={accent}
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-white/20 bg-white/5 p-4 text-center text-sm text-zinc-400">
                      {props.isPreview
                        ? "Checkout form renders on the live page."
                        : "Attach a product to this page to enable checkout."}
                    </p>
                  )}
                </div>

                <SecureFooter accent={accent} />

                {props.checkout_guarantee && (
                  <p className="mt-4 text-center text-xs text-zinc-400">
                    {props.checkout_guarantee}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <StickyCheckoutBar
        targetId="get"
        priceLabel={`₹${Number(productPrice).toLocaleString("en-IN")}`}
        cta={heroCta}
        buttonClassName="text-white"
        buttonStyle={{ backgroundColor: accent }}
        barClassName="border-t border-white/10"
        barStyle={{ backgroundColor: theme.card }}
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
