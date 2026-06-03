"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Lock,
  Play,
  Quote,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { tgTheme } from "@/lib/telegram-themes";
import { BgAnimation } from "./BgAnimation";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { StickyFormCta } from "@/components/templates/shared/StickyFormCta";
import type { BaseTemplateProps } from "./shared/types";

interface FeatureItem {
  /** Optional emoji / short glyph rendered in the accent icon tile. */
  icon?: string;
  title: string;
  description?: string;
}

interface BenefitItem {
  /** A single checkmark benefit line. */
  text: string;
}

interface LogoItem {
  /** Plain-text brand / partner name rendered in the trust strip. */
  name: string;
}

export interface SaasLandingPageProps extends BaseTemplateProps {
  // ── Hero ──────────────────────────────────────────────
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_primary_cta?: string;
  hero_secondary_cta?: string;
  /** Optional product screenshot / mockup image URL shown in the hero frame. */
  hero_screenshot_url?: string;
  /** Caption shown in the mockup frame when no screenshot is set. */
  hero_mockup_caption?: string;

  // ── Trust / logos / stat strip ────────────────────────
  trust_label?: string;
  logos?: LogoItem[];

  // ── Feature grid ──────────────────────────────────────
  features_title?: string;
  features_subtitle?: string;
  features?: FeatureItem[];

  // ── How it works / benefits with checkmarks ───────────
  benefits_title?: string;
  benefits_subtitle?: string;
  benefits?: BenefitItem[];

  // ── Testimonial ───────────────────────────────────────
  testimonial_quote?: string;
  testimonial_author?: string;
  testimonial_role?: string;

  // ── Email capture / early access ──────────────────────
  capture_title?: string;
  capture_subtitle?: string;
  capture_cta?: string;
  capture_privacy?: string;
  /** Optional URL the lead is redirected to after submitting. */
  redirect_url?: string;

  // ── Sticky mobile bar ─────────────────────────────────
  sticky_cta?: string;

  // ── Design ────────────────────────────────────────────
  /** Seller-pickable colour theme (dark gradient bg + accent). */
  theme_key?: string;
  /** Optional ambient background animation. */
  bg_animation?: string;
}

export function SaasLandingPage(props: SaasLandingPageProps) {
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  const logos = props.logos ?? [];
  const features = props.features ?? [];
  const benefits = props.benefits ?? [];

  // Reveal the sticky mobile CTA once the hero has scrolled away.
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="relative min-h-screen text-white"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10 pb-24 md:pb-0">
        {/* ================================================================
            HERO — eyebrow, headline, subheadline, dual CTA, product mockup
            ================================================================ */}
        <section className="relative isolate overflow-hidden">
          {/* Accent glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}33` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-44 top-1/2 h-[420px] w-[420px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}26` }}
          />
          {/* Grid overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-24 text-center md:pt-28">
            {props.hero_eyebrow && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
                style={{
                  borderColor: `${accent}99`,
                  backgroundColor: `${accent}26`,
                  color: "#fff",
                }}
              >
                <Sparkles className="h-3 w-3" />
                {props.hero_eyebrow}
              </span>
            )}

            <h1 className="mt-6 font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[64px]">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-xl">
                {props.hero_subheadline}
              </p>
            )}

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="#get"
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:scale-105 hover:opacity-90"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 18px 40px -12px ${accent}80`,
                }}
              >
                {props.hero_primary_cta ?? "Get early access"}
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </a>
              {props.hero_secondary_cta && (
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
                >
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${accent}33` }}
                  >
                    <Play className="h-3 w-3" style={{ color: accent }} />
                  </span>
                  {props.hero_secondary_cta}
                </a>
              )}
            </div>
          </div>

          {/* Product screenshot / mockup frame */}
          <div className="relative mx-auto max-w-5xl px-4 pb-16">
            <div
              className="overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                borderColor: `${accent}40`,
                background: theme.card,
                boxShadow: `0 40px 80px -24px ${accent}55`,
              }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-white/20" />
                <span className="h-3 w-3 rounded-full bg-white/20" />
                <span className="h-3 w-3 rounded-full bg-white/20" />
              </div>
              {props.hero_screenshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.hero_screenshot_url}
                  alt="Product preview"
                  className="block w-full"
                />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center px-6 text-center">
                  <div>
                    <span
                      aria-hidden
                      className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: `${accent}26`,
                        border: `1px solid ${accent}99`,
                      }}
                    >
                      <Sparkles className="h-6 w-6" style={{ color: accent }} />
                    </span>
                    <p className="mt-4 text-sm font-medium text-white/60">
                      {props.hero_mockup_caption ?? "Your product preview"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================
            TRUST / LOGOS STRIP
            ================================================================ */}
        {(props.trust_label || logos.length > 0) && (
          <section className="border-y border-white/10 py-10">
            <div className="mx-auto max-w-5xl px-4 text-center">
              {props.trust_label && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/45">
                  {props.trust_label}
                </p>
              )}
              {logos.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                  {logos.map((l, i) => (
                    <span
                      key={i}
                      className="font-sora text-lg font-bold tracking-tight text-white/55 transition hover:text-white/80"
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================
            FEATURE GRID — 3-up with accent icon tiles
            ================================================================ */}
        {features.length > 0 && (
          <section id="features" className="scroll-mt-20 py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {props.features_title ?? "Built for teams that ship"}
                </h2>
                {props.features_subtitle && (
                  <p className="mt-3 text-base leading-relaxed text-white/70">
                    {props.features_subtitle}
                  </p>
                )}
              </div>

              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl border p-6 shadow-xl transition-all duration-200 hover:-translate-y-1"
                    style={{
                      background: theme.card,
                      borderColor: `${accent}33`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm"
                      style={{
                        backgroundColor: `${accent}26`,
                        border: `1px solid ${accent}99`,
                      }}
                    >
                      {f.icon ? (
                        <span>{f.icon}</span>
                      ) : (
                        <Zap
                          className="h-6 w-6"
                          style={{ color: accent }}
                          strokeWidth={2.2}
                        />
                      )}
                    </span>
                    <h3 className="mt-5 font-sora text-lg font-bold tracking-tight text-white">
                      {f.title}
                    </h3>
                    {f.description && (
                      <p className="mt-2 text-sm leading-relaxed text-white/65">
                        {f.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            BENEFITS — two-column copy + checkmark list
            ================================================================ */}
        {benefits.length > 0 && (
          <section
            className="border-y border-white/10 py-16 md:py-24"
            style={{ backgroundColor: `${theme.card}80` }}
          >
            <div className="mx-auto grid max-w-6xl gap-12 px-4 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {props.benefits_title ?? "Everything works out of the box"}
                </h2>
                {props.benefits_subtitle && (
                  <p className="mt-4 text-base leading-relaxed text-white/70">
                    {props.benefits_subtitle}
                  </p>
                )}
              </div>

              <ul className="space-y-4">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${accent}26`,
                        border: `1px solid ${accent}99`,
                      }}
                    >
                      <Check
                        className="h-3.5 w-3.5"
                        style={{ color: accent }}
                        strokeWidth={3}
                      />
                    </span>
                    <span className="text-base leading-relaxed text-white/85">
                      {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ================================================================
            TESTIMONIAL — single short quote
            ================================================================ */}
        {props.testimonial_quote && (
          <section className="py-16 md:py-20">
            <div className="mx-auto max-w-3xl px-4 text-center">
              <Quote
                aria-hidden
                className="mx-auto h-9 w-9"
                style={{ color: accent }}
              />
              <blockquote className="mt-5 font-sora text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
                &ldquo;{props.testimonial_quote}&rdquo;
              </blockquote>
              <div className="mt-5 flex items-center justify-center gap-1">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star
                    key={s}
                    className="h-4 w-4"
                    style={{ color: accent, fill: accent }}
                  />
                ))}
              </div>
              {(props.testimonial_author || props.testimonial_role) && (
                <p className="mt-4 text-sm text-white/60">
                  {props.testimonial_author && (
                    <span className="font-semibold text-white/85">
                      {props.testimonial_author}
                    </span>
                  )}
                  {props.testimonial_author && props.testimonial_role && " · "}
                  {props.testimonial_role}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ================================================================
            EMAIL CAPTURE / GET EARLY ACCESS — white form card
            ================================================================ */}
        <section id="get" className="scroll-mt-20 px-4 pb-16 pt-8 md:pb-24">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {props.capture_title ?? "Get early access"}
              </h2>
              {props.capture_subtitle && (
                <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-white/70">
                  {props.capture_subtitle}
                </p>
              )}
            </div>

            {/* Form card stays white so inputs + labels are always legible;
                only the accent + the surrounding page go dark-themed. */}
            <div
              className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-7"
              style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
            >
              <div className="mb-4 text-center">
                <p
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  <Sparkles className="h-3 w-3" />
                  Early access
                </p>
              </div>

              {props.pageId && !props.isPreview ? (
                <LeadCaptureForm
                  pageId={props.pageId}
                  ctaLabel={props.capture_cta ?? "Get early access"}
                  requirePhone={false}
                  redirectUrl={props.redirect_url}
                  formConfig={props.formConfig}
                  primaryColor={accent}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                  Email-capture form renders on the live page.
                </p>
              )}

              <div className="mt-4 border-t border-zinc-100 pt-3">
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <Lock className="h-3 w-3" />
                  No spam · Unsubscribe anytime
                </p>
              </div>
            </div>

            {props.capture_privacy && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-white/45">
                <Check className="h-3 w-3" />
                {props.capture_privacy}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="mx-auto max-w-md">
            <SecureFooter accent={accent} variant="lite" />
          </div>
        </section>
      </div>

      {/* Sticky mobile CTA — scrolls to the capture form (#get) */}
      <div
        className={[
          "transition-opacity duration-300",
          stickyVisible ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <StickyFormCta
          label={props.sticky_cta ?? props.hero_primary_cta ?? "Get early access"}
          accent={accent}
          targetId="get"
        />
      </div>
    </div>
  );
}
