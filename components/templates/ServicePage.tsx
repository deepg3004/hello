"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Quote,
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

interface Deliverable {
  text: string;
  description?: string;
}
interface ProcessStep {
  title: string;
  description?: string;
}
interface StatItem {
  value: string;
  label?: string;
}
interface ServiceTestimonial {
  quote: string;
  author: string;
  role?: string;
}

export interface ServicePageProps extends BaseTemplateProps {
  // Hero
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  hero_image?: string;
  hero_provider_name?: string;
  hero_provider_role?: string;

  // Deliverables / what's included
  included_title?: string;
  included_subtitle?: string;
  included_items?: Deliverable[];

  // How it works
  process_title?: string;
  process_subtitle?: string;
  process_steps?: ProcessStep[];

  // Outcomes / stats
  stats_title?: string;
  stats_items?: StatItem[];

  // Testimonials
  testimonials_title?: string;
  testimonials_items?: ServiceTestimonial[];

  // Checkout
  checkout_title?: string;
  checkout_billing_note?: string;
  checkout_features_title?: string;
  checkout_features?: Deliverable[];
  checkout_guarantee?: string;

  /** Theme key (see lib/telegram-themes). Defaults to "midnight". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

const FALLBACK_PRICE = 4999;

export function ServicePage(props: ServicePageProps) {
  const included = props.included_items ?? [];
  const steps = props.process_steps ?? [];
  const stats = props.stats_items ?? [];
  const testimonials = props.testimonials_items ?? [];
  const features = props.checkout_features ?? [];

  const productName = props.product?.name ?? "Service";
  const productPrice = props.product?.price ?? FALLBACK_PRICE;
  const productCurrency = props.product?.currency ?? "INR";
  const priceLabel = `₹${Number(productPrice).toLocaleString("en-IN")}`;

  const heroCta = props.hero_cta ?? "Book your slot";

  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      {/* =====================================================================
          HERO — split: copy + CTA on the left, framed provider photo card on
          the right. Distinct from the centered membership gate / course hero.
          ===================================================================== */}
      <section className="relative isolate z-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-10%] top-[-20%] h-[560px] w-[560px] rounded-full blur-3xl"
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

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-16 md:px-6 lg:grid-cols-2 lg:gap-12 lg:pb-20 lg:pt-24">
          {/* Left — copy */}
          <div className="text-center lg:text-left">
            {props.hero_eyebrow && (
              <span
                className="mb-5 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-white"
                style={{
                  borderColor: `${accent}4d`,
                  backgroundColor: `${accent}1a`,
                }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} />
                {props.hero_eyebrow}
              </span>
            )}

            <h1 className="font-sora text-[38px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[56px]">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg lg:mx-0">
                {props.hero_subheadline}
              </p>
            )}

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="#book"
                style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accent}40` }}
                className="inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-semibold text-white transition hover:scale-105 hover:opacity-90 sm:text-lg"
              >
                {heroCta}
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </a>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
                <BadgeCheck className="h-4 w-4" style={{ color: accent }} />
                Limited slots available
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/60 md:text-sm lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Done-for-you
              </span>
              <span className="opacity-40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Fast turnaround
              </span>
              <span className="opacity-40">•</span>
              <span>📱 UPI accepted</span>
            </div>
          </div>

          {/* Right — provider photo card */}
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
              style={{ boxShadow: `0 30px 80px ${accent}26` }}
            >
              {props.hero_image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.hero_image}
                  alt={props.hero_provider_name ?? props.hero_headline}
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div
                  className="aspect-[4/5] w-full"
                  style={{
                    background: `linear-gradient(135deg, ${accent}40, ${accent}1f 60%, ${theme.card})`,
                  }}
                />
              )}
              {(props.hero_provider_name || props.hero_provider_role) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5">
                  {props.hero_provider_name && (
                    <p className="font-sora text-lg font-bold text-white">
                      {props.hero_provider_name}
                    </p>
                  )}
                  {props.hero_provider_role && (
                    <p className="text-sm text-white/70">
                      {props.hero_provider_role}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          DELIVERABLES — "What's included" grid
          ===================================================================== */}
      {included.length > 0 && (
        <section className="relative z-10">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 lg:py-16">
            {props.included_title && (
              <h2 className="text-center font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {props.included_title}
              </h2>
            )}
            {props.included_subtitle && (
              <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-zinc-400 sm:text-base">
                {props.included_subtitle}
              </p>
            )}
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {included.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  style={{ backgroundColor: theme.card }}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: accent }}
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-sora text-sm font-semibold text-white">
                      {d.text}
                    </p>
                    {d.description && (
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                        {d.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* =====================================================================
          HOW IT WORKS — 3-step process strip
          ===================================================================== */}
      {steps.length > 0 && (
        <section className="relative z-10">
          <div className="mx-auto max-w-6xl px-4 pb-12 md:px-6 lg:pb-16">
            <div
              className="rounded-3xl border border-white/10 px-5 py-10 shadow-lg md:px-10"
              style={{ backgroundColor: theme.card }}
            >
              {props.process_title && (
                <h2 className="text-center font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {props.process_title}
                </h2>
              )}
              {props.process_subtitle && (
                <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {props.process_subtitle}
                </p>
              )}
              <ol className="mt-9 grid gap-6 md:grid-cols-3">
                {steps.map((s, i) => (
                  <li key={i} className="relative text-center md:text-left">
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-sora text-lg font-bold text-white"
                      style={{
                        backgroundColor: `${accent}26`,
                        border: `1px solid ${accent}66`,
                        color: accent,
                      }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="mt-4 font-sora text-base font-semibold text-white">
                      {s.title}
                    </h3>
                    {s.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                        {s.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          OUTCOMES — stats strip
          ===================================================================== */}
      {stats.length > 0 && (
        <section className="relative z-10">
          <div className="mx-auto max-w-6xl px-4 pb-12 md:px-6 lg:pb-16">
            {props.stats_title && (
              <h2 className="text-center font-sora text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {props.stats_title}
              </h2>
            )}
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((st, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-6 text-center shadow-lg"
                  style={{
                    borderColor: `${accent}33`,
                    backgroundColor: `${accent}14`,
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="h-5 w-5" style={{ color: accent }} />
                    <span className="font-sora text-3xl font-bold text-white">
                      {st.value}
                    </span>
                  </div>
                  {st.label && (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {st.label}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MAIN — testimonials (left) + sticky "Book your slot" checkout (right)
          ===================================================================== */}
      <div className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6 lg:pb-20">
          <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
            {/* ── LEFT (testimonials) ────────────────────────────────── */}
            <div className="space-y-10 lg:col-span-2">
              {testimonials.length > 0 && (
                <section
                  className="overflow-hidden rounded-2xl border border-white/10 px-5 py-8 shadow-lg md:px-8 md:py-10"
                  style={{ backgroundColor: theme.card }}
                >
                  {props.testimonials_title && (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <h2 className="font-sora text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {props.testimonials_title}
                      </h2>
                      <Stars rating={5} className="text-amber-400" />
                    </div>
                  )}

                  <div className="-mx-2 mt-6 flex gap-4 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {testimonials.map((t, i) => (
                      <figure
                        key={i}
                        className="min-w-[270px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur md:min-w-0"
                      >
                        <Quote
                          className="mb-2 h-5 w-5"
                          style={{ color: accent }}
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

            {/* ── RIGHT (sticky "Book your slot" checkout) ───────────── */}
            <aside
              id="book"
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
                  <Star className="h-3 w-3" style={{ color: accent }} fill="currentColor" />
                  Book your slot
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
                    {priceLabel}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {props.checkout_billing_note ??
                      (productCurrency === "INR" ? "INR" : productCurrency)}
                  </span>
                </div>

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
                          <span>{it.text}</span>
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
        targetId="book"
        priceLabel={priceLabel}
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
