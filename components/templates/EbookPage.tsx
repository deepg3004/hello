"use client";

import { ArrowRight, BookOpen, Check, Download, FileText, Lock, Sparkles, Star } from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { BgAnimation } from "./BgAnimation";
import { Stars } from "./shared/Stars";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import type { BaseTemplateProps } from "./shared/types";
import { tgTheme } from "@/lib/telegram-themes";

interface Chapter {
  title: string;
  description?: string;
}
interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

export interface EbookPageProps extends BaseTemplateProps {
  // Hero
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  /** Optional book-cover image. When absent we render a CSS 3D book cover. */
  hero_image?: string;
  /** Short label embossed on the CSS book cover (e.g. "EBOOK", "GUIDE", "PDF"). */
  book_label?: string;
  /** Small line under the CTA (e.g. "Instant PDF download · 120 pages"). */
  hero_meta?: string;

  // What's inside / chapters
  chapters_title?: string;
  chapters_subtitle?: string;
  chapters_items?: Chapter[];

  // About the author
  author_eyebrow?: string;
  author_name?: string;
  author_title?: string;
  author_bio?: string;
  author_avatar?: string;

  // Testimonials
  testimonials_title?: string;
  testimonials_items?: Testimonial[];

  // Checkout
  checkout_title?: string;
  checkout_subtitle?: string;
  checkout_guarantee?: string;

  /** Theme key (see lib/telegram-themes). Defaults to "gold". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

const FALLBACK_PRICE = 499;

export function EbookPage(props: EbookPageProps) {
  const chapters = props.chapters_items ?? [];
  const testimonials = props.testimonials_items ?? [];

  const productName = props.product?.name ?? "eBook";
  const productPrice = props.product?.price ?? FALLBACK_PRICE;
  const productCurrency = props.product?.currency ?? "INR";

  const heroCta = props.hero_cta ?? "Get the eBook";
  const bookLabel = (props.book_label ?? "EBOOK").toUpperCase();

  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  const priceLabel = `₹${Number(productPrice).toLocaleString("en-IN")}`;

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10">
        {/* =================================================================
            HERO — book cover mockup on the left, copy + CTA on the right
            ================================================================= */}
        <section className="relative isolate overflow-hidden">
          {/* Decorative accent glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}26` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 top-20 h-[360px] w-[360px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}1f` }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 md:grid-cols-2 md:gap-16 md:pb-24 md:pt-24">
            {/* Book cover */}
            <div className="order-first flex justify-center md:order-none">
              {props.hero_image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.hero_image}
                  alt={props.hero_headline}
                  className="aspect-[3/4] w-full max-w-[320px] rounded-2xl object-cover shadow-2xl shadow-black/50"
                  style={{ boxShadow: `0 30px 70px ${accent}33` }}
                />
              ) : (
                <BookCover
                  label={bookLabel}
                  title={props.hero_headline}
                  accent={accent}
                />
              )}
            </div>

            {/* Copy */}
            <div className="text-center md:text-left">
              {props.hero_eyebrow && (
                <span
                  className="mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-white"
                  style={{
                    borderColor: `${accent}4d`,
                    backgroundColor: `${accent}1a`,
                  }}
                >
                  <BookOpen className="h-3 w-3" />
                  {props.hero_eyebrow}
                </span>
              )}

              <h1 className="font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[56px]">
                {props.hero_headline}
              </h1>

              {props.hero_subheadline && (
                <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
                  {props.hero_subheadline}
                </p>
              )}

              <a
                href="#buy"
                style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accent}40` }}
                className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-black transition hover:scale-105 hover:opacity-90 sm:px-10 sm:text-lg"
              >
                <Download className="h-5 w-5" strokeWidth={2.5} />
                {heroCta}
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </a>

              {props.hero_meta && (
                <p className="mt-4 text-sm text-white/60">{props.hero_meta}</p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/60 md:justify-start md:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Secure payment
                </span>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Instant PDF
                </span>
                <span className="opacity-40">•</span>
                <span>📱 UPI accepted</span>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            WHAT'S INSIDE / CHAPTERS
            ================================================================= */}
        {chapters.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 py-12 md:py-16">
            <div className="text-center">
              {props.chapters_title && (
                <h2 className="font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {props.chapters_title}
                </h2>
              )}
              {props.chapters_subtitle && (
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {props.chapters_subtitle}
                </p>
              )}
            </div>

            <ol className="mt-8 grid gap-4 sm:grid-cols-2">
              {chapters.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-4 rounded-xl border p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  style={{ backgroundColor: theme.card, borderColor: `${accent}26` }}
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-sora text-sm font-bold text-black"
                    style={{ backgroundColor: accent }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="font-sora text-sm font-semibold text-white">
                      {c.title}
                    </p>
                    {c.description && (
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                        {c.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* =================================================================
            ABOUT THE AUTHOR
            ================================================================= */}
        {(props.author_name || props.author_bio) && (
          <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
            <div
              className="rounded-2xl border p-6 shadow-lg md:p-10"
              style={{ backgroundColor: theme.card, borderColor: `${accent}26` }}
            >
              <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
                <div
                  className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 bg-white/5 shadow-lg"
                  style={{ borderColor: accent }}
                >
                  {props.author_avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={props.author_avatar}
                      alt={props.author_name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white"
                      style={{ backgroundColor: `${accent}33` }}
                    >
                      {(props.author_name ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: accent }}
                  >
                    {props.author_eyebrow ?? "About the author"}
                  </p>
                  <h3 className="mt-1 font-sora text-2xl font-bold tracking-tight text-white">
                    {props.author_name}
                  </h3>
                  {props.author_title && (
                    <p className="text-sm text-zinc-400">{props.author_title}</p>
                  )}
                  {props.author_bio && (
                    <p className="mt-3 text-base leading-relaxed text-zinc-300">
                      {props.author_bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =================================================================
            TESTIMONIALS — short strip
            ================================================================= */}
        {testimonials.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
            {props.testimonials_title && (
              <h2 className="text-center font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {props.testimonials_title}
              </h2>
            )}
            <div className="-mx-2 mt-8 flex gap-4 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="min-w-[280px] shrink-0 rounded-2xl border p-6 shadow-lg md:min-w-0"
                  style={{ backgroundColor: theme.card, borderColor: `${accent}26` }}
                >
                  <Stars rating={5} className="mb-3 text-amber-400" />
                  <blockquote className="text-sm leading-relaxed text-white/90">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-black"
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

        {/* =================================================================
            CHECKOUT CARD
            ================================================================= */}
        <section
          id="buy"
          className="mx-auto max-w-md scroll-mt-8 px-4 py-12 md:py-16"
        >
          <div
            className="rounded-2xl border p-6 shadow-2xl md:p-8"
            style={{ backgroundColor: theme.card, borderColor: `${accent}40` }}
          >
            <div className="text-center">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Sparkles className="h-3 w-3" />
                {props.checkout_subtitle ?? "Instant download"}
              </span>
              {props.checkout_title && (
                <h3 className="mt-3 font-sora text-xl font-bold tracking-tight text-white">
                  {props.checkout_title}
                </h3>
              )}
              <p className="mt-1 truncate text-sm text-zinc-400">{productName}</p>
            </div>

            <div className="mt-4 flex items-baseline justify-center gap-2">
              <span className="font-sora text-4xl font-bold text-white">
                {priceLabel}
              </span>
              <span className="text-sm text-zinc-400">
                {productCurrency === "INR" ? "INR" : productCurrency} · one-time
              </span>
            </div>

            <div className="mt-6">
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
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-400">
                <Star className="h-3 w-3" style={{ color: accent }} />
                {props.checkout_guarantee}
              </p>
            )}
          </div>
        </section>

      </div>

      {/* Sticky mobile CTA */}
      <StickyCheckoutBar
        targetId="buy"
        priceLabel={priceLabel}
        cta={heroCta}
        buttonClassName="text-black"
        buttonStyle={{ backgroundColor: accent }}
        barClassName="border-t border-white/10"
        barStyle={{ backgroundColor: theme.card }}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

/**
 * CSS-built 3D book cover used when the seller hasn't uploaded a mockup.
 * Accent-tinted gradient face, a thick spine on the left for depth, a
 * paper-fold page edge, and the title embossed in the centre.
 */
function BookCover({
  label,
  title,
  accent,
}: {
  label: string;
  title: string;
  accent: string;
}) {
  const coverTitle =
    title.length > 60 ? title.slice(0, 57).trim() + "…" : title;
  return (
    <div className="relative aspect-[3/4] w-full max-w-[300px] [perspective:1400px]">
      <div
        className="relative h-full w-full rounded-r-xl rounded-l-md shadow-2xl shadow-black/50 transition-transform duration-500 [transform:rotateY(-18deg)] hover:[transform:rotateY(-6deg)]"
        style={{
          background: `linear-gradient(115deg, ${accent} 0%, ${accent}cc 45%, ${accent}80 100%)`,
          boxShadow: `0 30px 70px ${accent}33, -14px 0 0 0 ${accent}66`,
        }}
      >
        {/* Spine shading on the left */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-5 rounded-l-md"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        {/* Paper-fold page edge on the right */}
        <div
          aria-hidden
          className="absolute inset-y-3 right-0 w-2 rounded-r-sm"
          style={{
            background:
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.5) 0 2px, rgba(255,255,255,0) 2px 4px)",
          }}
        />
        {/* Highlight sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-r-xl rounded-l-md"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 50%)",
          }}
        />
        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-between px-6 py-8 text-black">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-black/70">
            {label}
          </p>
          <p className="text-center font-sora text-xl font-bold leading-snug text-black">
            {coverTitle}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-black/60">
            invoxai.io
          </p>
        </div>
      </div>
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
