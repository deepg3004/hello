"use client";

import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Lock,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { BgAnimation } from "./BgAnimation";
import { Countdown } from "./shared/Countdown";
import { Stars } from "./shared/Stars";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import type { BaseTemplateProps, OrderBumpConfig } from "./shared/types";
import { tgTheme } from "@/lib/telegram-themes";

interface Benefit {
  text: string;
  /** Optional 1-line description rendered under the benefit. */
  description?: string;
}
interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}
interface FaqItem {
  q: string;
  a: string;
}

export interface PaymentCoursePageProps extends BaseTemplateProps {
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  hero_image?: string;
  benefits_title?: string;
  benefits_items?: Benefit[];
  instructor_name?: string;
  instructor_title?: string;
  instructor_bio?: string;
  instructor_avatar?: string;
  /** "2,400+ students" etc. Optional small line under instructor name. */
  instructor_stats?: string;
  /** "4.9" — drives star count under the instructor row. */
  instructor_rating?: number;
  testimonials_title?: string;
  testimonials_items?: Testimonial[];
  faq_title?: string;
  faq_items?: FaqItem[];
  checkout_title?: string;
  checkout_guarantee?: string;
  /** Bullets shown inside the checkout card under "What's included". */
  whats_included?: Benefit[];
  /** Theme key (see lib/telegram-themes). Defaults to "midnight". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

const FALLBACK_PRICE = 999;

// Subtle icon rotation for the benefits grid — keeps cards visually
// distinct without needing a per-benefit icon field in the editor.
const BENEFIT_ICONS = [BookOpen, TrendingUp, Award, Sparkles, Zap, Check];

export function PaymentCoursePage(props: PaymentCoursePageProps) {
  const benefits = props.benefits_items ?? [];
  const testimonials = props.testimonials_items ?? [];
  const faqs = props.faq_items ?? [];
  const whatsIncluded = props.whats_included ?? [];
  const bump: OrderBumpConfig = props.orderBump ?? {};

  const productName = props.product?.name ?? "Course";
  const productPrice = props.product?.price ?? FALLBACK_PRICE;
  const productCurrency = props.product?.currency ?? "INR";

  const heroCta = props.hero_cta ?? "Enrol Now";
  const timer = props.timer;

  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />
      {/* =====================================================================
          HERO — premium dark academic, gradient + accent radial glow
          ===================================================================== */}
      <section
        className="relative isolate z-10 overflow-hidden"
        style={{ minHeight: "80vh" }}
      >
        {/* Decorative glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}26` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}33` }}
        />
        {/* Subtle dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-16 md:grid-cols-2 md:gap-12 md:pb-24 md:pt-20">
          <div className="text-center md:text-left">
            {timer?.enabled && timer.target && (
              <div className="mb-6 flex justify-center md:justify-start">
                <Countdown
                  targetIso={timer.target}
                  label={timer.label ?? "Offer ends in"}
                  boxClassName="bg-white/10 text-white"
                />
              </div>
            )}

            {props.hero_eyebrow && (
              <span
                className="mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-white"
                style={{
                  borderColor: `${accent}4d`,
                  backgroundColor: `${accent}1a`,
                }}
              >
                <Sparkles className="h-3 w-3" />
                {props.hero_eyebrow}
              </span>
            )}

            <h1
              className="font-sora text-[42px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
              style={{ maxWidth: "32rem" }}
            >
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
                {props.hero_subheadline}
              </p>
            )}

            <a
              href="#enrol"
              style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accent}40` }}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition hover:scale-105 hover:opacity-90 sm:px-10 sm:text-lg"
            >
              {heroCta}
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </a>

            {/* Trust strip */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/60 md:justify-start md:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Secure payment
              </span>
              <span className="opacity-40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Instant access
              </span>
              <span className="opacity-40">•</span>
              <span>📱 UPI accepted</span>
            </div>
          </div>

          {/* Hero image — placeholder gradient if not supplied */}
          <div className="order-first md:order-last">
            {props.hero_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={props.hero_image}
                alt={props.hero_headline}
                className="aspect-[4/3] w-full rounded-2xl border border-white/10 object-cover shadow-2xl"
                style={{ boxShadow: `0 24px 60px ${accent}26` }}
              />
            ) : (
              <div
                className="aspect-[4/3] w-full rounded-2xl border border-white/10 shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${accent}40, ${accent}1f 60%, ${theme.card})`,
                  boxShadow: `0 24px 60px ${accent}26`,
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          MAIN CONTENT — 3-col on lg with sticky checkout on the right
          ===================================================================== */}
      <div className="relative z-10 text-zinc-100">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
            {/* ── LEFT (content) ─────────────────────────────────────── */}
            <div className="space-y-8 lg:col-span-2 lg:space-y-12">
              {/* Benefits */}
              {benefits.length > 0 && (
                <section>
                  {props.benefits_title && (
                    <h2 className="text-center font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {props.benefits_title}
                    </h2>
                  )}
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {benefits.map((b, i) => {
                      const Icon =
                        BENEFIT_ICONS[i % BENEFIT_ICONS.length] ?? Check;
                      return (
                        <li
                          key={i}
                          className="group rounded-xl border border-white/10 p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                          style={{ backgroundColor: theme.card }}
                        >
                          <span
                            aria-hidden
                            className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm"
                            style={{ backgroundColor: accent }}
                          >
                            <Icon className="h-4 w-4" strokeWidth={2.25} />
                          </span>
                          <p className="font-sora text-sm font-semibold text-white">
                            {b.text}
                          </p>
                          {b.description && (
                            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                              {b.description}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* Instructor */}
              {(props.instructor_name || props.instructor_bio) && (
                <section
                  className="rounded-2xl border border-white/10 p-6 shadow-lg md:p-8"
                  style={{ backgroundColor: theme.card }}
                >
                  <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-start md:text-left">
                    <div
                      className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 bg-white/5 shadow-lg"
                      style={{ borderColor: accent }}
                    >
                      {props.instructor_avatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={props.instructor_avatar}
                          alt={props.instructor_name ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white"
                          style={{ backgroundColor: `${accent}33` }}
                        >
                          {(props.instructor_name ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: accent }}
                      >
                        Your instructor
                      </p>
                      <h3 className="mt-1 font-sora text-2xl font-bold tracking-tight text-white">
                        {props.instructor_name}
                      </h3>
                      {props.instructor_title && (
                        <p className="text-sm text-zinc-400">
                          {props.instructor_title}
                        </p>
                      )}
                      {(props.instructor_stats || props.instructor_rating) && (
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm md:justify-start">
                          {props.instructor_rating != null && (
                            <span className="inline-flex items-center gap-1">
                              <Stars
                                rating={props.instructor_rating}
                                className="text-amber-400"
                              />
                              <span className="font-semibold text-white">
                                {props.instructor_rating.toFixed(1)}★
                              </span>
                            </span>
                          )}
                          {props.instructor_stats && (
                            <>
                              {props.instructor_rating != null && (
                                <span className="text-zinc-500">·</span>
                              )}
                              <span className="text-zinc-300">
                                {props.instructor_stats}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      {props.instructor_bio && (
                        <p className="mt-3 text-base leading-relaxed text-zinc-300">
                          {props.instructor_bio}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Testimonials — dark contrast block */}
              {testimonials.length > 0 && (
                <section
                  className="overflow-hidden rounded-2xl border border-white/10 px-5 py-8 shadow-lg md:px-8 md:py-12"
                  style={{ backgroundColor: theme.card }}
                >
                  {props.testimonials_title && (
                    <h2 className="text-center font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {props.testimonials_title}
                    </h2>
                  )}
                  {/* Horizontal scroll on mobile, grid on md+. Scrollbar hidden
                      via a tiny inline class — keep tidy on touch devices. */}
                  <div className="-mx-2 mt-6 flex gap-4 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {testimonials.map((t, i) => (
                      <figure
                        key={i}
                        className="min-w-[280px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur md:min-w-0"
                      >
                        <Stars rating={5} className="mb-3 text-amber-400" />
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

              {/* FAQ */}
              {faqs.length > 0 && (
                <section
                  className="rounded-2xl border border-white/10 p-6 shadow-lg md:p-8"
                  style={{ backgroundColor: theme.card }}
                >
                  {props.faq_title && (
                    <h2 className="text-center font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {props.faq_title}
                    </h2>
                  )}
                  <div className="mx-auto mt-6 max-w-2xl">
                    <Accordion type="single" collapsible className="w-full">
                      {faqs.map((f, i) => (
                        <AccordionItem
                          key={i}
                          value={`faq-${i}`}
                          className="border-white/10"
                        >
                          <AccordionTrigger className="text-left text-[15px] font-semibold text-white hover:no-underline">
                            {f.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm leading-relaxed text-zinc-300">
                            {f.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </section>
              )}
            </div>

            {/* ── RIGHT (sticky checkout) ────────────────────────────── */}
            <aside
              id="enrol"
              className="scroll-mt-8 lg:col-span-1 lg:sticky lg:top-8 lg:self-start"
            >
              <div
                className="rounded-2xl border border-white/10 p-6 shadow-2xl"
                style={{ backgroundColor: theme.card }}
              >
                {props.checkout_title && (
                  <h3 className="font-sora text-xl font-bold tracking-tight text-white">
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
                    {productCurrency === "INR" ? "INR" : productCurrency} ·
                    one-time
                  </span>
                </div>

                {whatsIncluded.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      What&apos;s included
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {whatsIncluded.slice(0, 6).map((it, i) => (
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

                {/* Bump */}
                {bump.enabled && (
                  <div
                    className="mt-5 flex items-start gap-3 rounded-lg border-2 border-dashed p-3"
                    style={{
                      borderColor: `${accent}99`,
                      backgroundColor: `${accent}1a`,
                    }}
                  >
                    <input
                      type="checkbox"
                      id="order-bump"
                      className="mt-1 h-4 w-4 cursor-pointer"
                      style={{ accentColor: accent }}
                      readOnly
                    />
                    <label
                      htmlFor="order-bump"
                      className="flex-1 cursor-pointer"
                    >
                      <div className="text-sm font-semibold text-white">
                        {bump.title ?? "Add the bonus pack"}
                        {typeof bump.price === "number" && (
                          <span
                            className="ml-2 rounded px-1.5 py-0.5 text-xs text-white"
                            style={{ backgroundColor: `${accent}40` }}
                          >
                            +₹{bump.price.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                      {bump.description && (
                        <p className="mt-1 text-xs text-zinc-300">
                          {bump.description}
                        </p>
                      )}
                    </label>
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

                {/* Security + payment methods */}
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
        targetId="enrol"
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
