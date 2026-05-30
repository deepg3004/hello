"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { Countdown } from "./shared/Countdown";
import { Stars } from "./shared/Stars";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type {
  BaseTemplateProps,
  OrderBumpConfig,
  ThemeConfig,
  TimerConfig,
} from "./shared/types";
import { DEFAULT_THEME } from "./shared/types";

interface Benefit { text: string }
interface Testimonial { quote: string; author: string; role?: string }
interface FaqItem { q: string; a: string }

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
  testimonials_title?: string;
  testimonials_items?: Testimonial[];
  faq_title?: string;
  faq_items?: FaqItem[];
  checkout_title?: string;
  checkout_guarantee?: string;
}

const FALLBACK_PRODUCT_NAME = "Sample course";
const FALLBACK_PRICE = 999;

export function PaymentCoursePage(props: PaymentCoursePageProps) {
  const theme: Required<ThemeConfig> = {
    ...DEFAULT_THEME,
    bgFrom: "#0a1828",
    bgTo: "#0d1f33",
    heroText: "#ffffff",
    primary: "#d4af37",
    mode: "dark",
    ...props.theme,
  };
  const timer: TimerConfig = props.timer ?? {};
  const bump: OrderBumpConfig = props.orderBump ?? {};

  const benefits = props.benefits_items ?? [];
  const testimonials = props.testimonials_items ?? [];
  const faqs = props.faq_items ?? [];

  const productName = props.product?.name ?? FALLBACK_PRODUCT_NAME;
  const productPrice = props.product?.price ?? FALLBACK_PRICE;

  const showStars = testimonials.length > 3;

  return (
    <div className="min-h-screen bg-[#0a1828] text-zinc-100">
      {/* ===== HERO with gradient ===== */}
      <section
        className="relative isolate overflow-hidden px-4 pb-20 pt-16 sm:pb-24"
        style={{
          background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 60%, #08111c 100%)`,
          color: theme.heroText,
        }}
      >
        {/* Decorative blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: theme.primary, opacity: 0.18 }}
        />

        {/* Timer */}
        {timer.enabled && timer.target && (
          <div className="mx-auto mb-10 flex max-w-3xl justify-center">
            <Countdown
              targetIso={timer.target}
              label={timer.label ?? "Offer ends in"}
              boxClassName="bg-white/10 text-white"
            />
          </div>
        )}

        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div className="text-center md:text-left">
            {props.hero_eyebrow && (
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ color: theme.primary }}
              >
                {props.hero_eyebrow}
              </p>
            )}
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {props.hero_headline}
            </h1>
            {props.hero_subheadline && (
              <p className="mt-5 text-lg leading-relaxed text-zinc-300">
                {props.hero_subheadline}
              </p>
            )}
            {showStars && (
              <div className="mt-5 flex flex-col items-center gap-1 md:items-start">
                <Stars rating={5} className="text-[#d4af37]" />
                <span className="text-sm text-zinc-400">
                  {testimonials.length}+ five-star reviews
                </span>
              </div>
            )}
            <a
              href="#enrol"
              className="mt-8 inline-block rounded-md px-6 py-3 text-sm font-semibold shadow"
              style={{ background: theme.primary, color: "#0a1828" }}
            >
              {props.hero_cta ?? "Enrol Now"}
            </a>
          </div>

          {/* Hero image */}
          <div className="hidden md:block">
            {props.hero_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.hero_image}
                alt={props.hero_headline}
                className="aspect-video w-full rounded-xl border border-white/10 object-cover shadow-2xl"
              />
            ) : (
              <div className="aspect-video w-full rounded-xl border border-white/10 bg-white/5 shadow-2xl" />
            )}
          </div>
        </div>
      </section>

      {/* ===== BENEFITS ===== */}
      {benefits.length > 0 && (
        <section className="border-t border-white/5 bg-[#0d1f33] py-16">
          <div className="mx-auto max-w-3xl px-6">
            {props.benefits_title && (
              <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                {props.benefits_title}
              </h2>
            )}
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefits.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-white/5 bg-[#0a1828] p-4"
                >
                  <span
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: theme.primary, color: "#0a1828" }}
                  >
                    ✓
                  </span>
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ===== INSTRUCTOR ===== */}
      {(props.instructor_name || props.instructor_bio) && (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center md:flex-row md:text-left">
            <div
              className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 bg-zinc-900"
              style={{ borderColor: `${theme.primary}80` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {props.instructor_avatar ? (
                <img
                  src={props.instructor_avatar}
                  alt={props.instructor_name ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-500">
                  {(props.instructor_name ?? "?")[0]}
                </div>
              )}
            </div>
            <div>
              <p
                className="text-xs uppercase tracking-widest"
                style={{ color: theme.primary }}
              >
                Your instructor
              </p>
              <h3 className="mt-1 text-xl font-semibold">{props.instructor_name}</h3>
              <p className="text-sm text-zinc-400">{props.instructor_title}</p>
              <p className="mt-3 text-zinc-300">{props.instructor_bio}</p>
            </div>
          </div>
        </section>
      )}

      {/* ===== TESTIMONIALS ===== */}
      {testimonials.length > 0 && (
        <section className="border-t border-white/5 bg-[#0d1f33] py-16">
          <div className="mx-auto max-w-6xl px-6">
            {props.testimonials_title && (
              <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                {props.testimonials_title}
              </h2>
            )}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="rounded-lg border border-white/5 bg-[#0a1828] p-5"
                >
                  <Stars rating={5} className="mb-3 text-[#d4af37]" />
                  <blockquote className="text-sm leading-relaxed text-zinc-200">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ background: theme.primary, color: "#0a1828" }}
                    >
                      {initials(t.author)}
                    </span>
                    <div>
                      <div className="text-sm font-medium" style={{ color: theme.primary }}>
                        {t.author}
                      </div>
                      {t.role && (
                        <div className="text-xs text-zinc-400">{t.role}</div>
                      )}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== FAQ accordion ===== */}
      {faqs.length > 0 && (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-2xl px-6">
            {props.faq_title && (
              <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                {props.faq_title}
              </h2>
            )}
            <Accordion type="single" collapsible className="mt-6">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-white/10">
                  <AccordionTrigger className="text-left text-zinc-100 hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-400">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* ===== CHECKOUT ===== */}
      <section
        id="enrol"
        className="scroll-mt-16 border-t border-white/5 bg-[#0d1f33] pb-32 pt-16 md:pb-16"
      >
        <div className="mx-auto max-w-5xl px-6">
          {props.checkout_title && (
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              {props.checkout_title}
            </h2>
          )}
          {props.checkout_guarantee && (
            <p className="mt-2 text-center text-sm text-zinc-400">
              {props.checkout_guarantee}
            </p>
          )}
          <div className="mt-8 rounded-xl bg-white p-6 text-zinc-900 shadow-2xl">
            {bump.enabled && (
              <div className="mb-4 flex items-start gap-3 rounded-md border-2 border-dashed border-amber-300 bg-amber-50 p-3">
                <input
                  type="checkbox"
                  id="order-bump"
                  className="mt-1 h-4 w-4 cursor-pointer accent-amber-600"
                  readOnly
                />
                <label htmlFor="order-bump" className="flex-1 cursor-pointer">
                  <div className="text-sm font-semibold text-amber-900">
                    {bump.title ?? "Add the bonus pack"}{" "}
                    {typeof bump.price === "number" && (
                      <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-900">
                        +₹{bump.price.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  {bump.description && (
                    <p className="mt-1 text-xs text-amber-800">{bump.description}</p>
                  )}
                </label>
              </div>
            )}

            {props.pageId && props.product && !props.isPreview ? (
              <CheckoutForm
                pageId={props.pageId}
                productId={props.product.id}
                productName={props.product.name}
                productDescription={props.product.description}
                productImage={props.product.image_url}
                price={Number(props.product.price)}
                currency={props.product.currency}
                orderBump={props.bumpRuntime ? { ...props.bumpRuntime, ready: true } : undefined}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                {props.isPreview
                  ? "Checkout form renders on the live page."
                  : "Attach a product to this page to enable checkout."}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      <StickyCheckoutBar
        targetId="enrol"
        priceLabel={`₹${Number(productPrice).toLocaleString("en-IN")}`}
        cta={props.hero_cta ?? "Enrol Now"}
        buttonClassName="bg-[#d4af37] text-[#0a1828]"
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
