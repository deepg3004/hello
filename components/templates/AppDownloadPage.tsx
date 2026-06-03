"use client";

import Image from "next/image";
import {
  Apple,
  Check,
  Download,
  Lock,
  Play,
  Smartphone,
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
  /** Optional emoji / short glyph rendered in the icon tile. */
  icon?: string;
  title: string;
  description?: string;
}

export interface AppDownloadPageProps extends BaseTemplateProps {
  // ── Hero (left column) ────────────────────────────────
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  /** Store badge labels — rendered as styled pill buttons. */
  appstore_label?: string;
  appstore_caption?: string;
  googleplay_label?: string;
  googleplay_caption?: string;
  /** Rating line — stars + count copy. */
  rating_value?: string;
  rating_caption?: string;

  // ── Phone mockup (right column) ───────────────────────
  /** App screenshot shown inside the phone shell. Accent-tinted if empty. */
  screenshot_url?: string;
  phone_caption?: string;

  // ── Features grid ─────────────────────────────────────
  features_title?: string;
  features_subtitle?: string;
  features?: FeatureItem[];

  // ── Testimonial ───────────────────────────────────────
  testimonial_quote?: string;
  testimonial_author?: string;
  testimonial_role?: string;

  // ── Email capture ─────────────────────────────────────
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

export function AppDownloadPage(props: AppDownloadPageProps) {
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  const features = props.features ?? [];
  const captureCta = props.capture_cta ?? "Get the download link";

  return (
    <div
      className="relative min-h-screen text-white"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10 pb-24 md:pb-0">
        {/* ================================================================
            HERO — two columns: copy + store badges (left), phone (right)
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
            className="pointer-events-none absolute -left-44 top-1/3 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}26` }}
          />

          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-16 sm:pt-20 lg:grid-cols-2 lg:gap-10">
            {/* ── LEFT: copy + CTA + store badges + rating ──────────── */}
            <div className="text-center lg:text-left">
              {props.hero_eyebrow && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
                  style={{
                    borderColor: `${accent}99`,
                    backgroundColor: `${accent}26`,
                    color: "#fff",
                  }}
                >
                  <Smartphone className="h-3 w-3" />
                  {props.hero_eyebrow}
                </span>
              )}

              <h1 className="mt-6 font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
                {props.hero_headline}
              </h1>

              {props.hero_subheadline && (
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg lg:mx-0">
                  {props.hero_subheadline}
                </p>
              )}

              {/* Store badge pill buttons (no store assets — styled pills). */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:items-start lg:justify-start">
                <a
                  href="#get"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-black/40 px-5 py-3 text-left transition hover:scale-[1.03] hover:border-white/30 sm:w-auto"
                  style={{ boxShadow: `0 14px 32px -16px ${accent}80` }}
                >
                  <Apple className="h-7 w-7 text-white" />
                  <span className="leading-tight">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-white/55">
                      {props.appstore_caption ?? "Download on the"}
                    </span>
                    <span className="block text-base font-semibold text-white">
                      {props.appstore_label ?? "App Store"}
                    </span>
                  </span>
                </a>

                <a
                  href="#get"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-black/40 px-5 py-3 text-left transition hover:scale-[1.03] hover:border-white/30 sm:w-auto"
                  style={{ boxShadow: `0 14px 32px -16px ${accent}80` }}
                >
                  <Play
                    className="h-6 w-6"
                    style={{ color: accent }}
                    fill={accent}
                  />
                  <span className="leading-tight">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-white/55">
                      {props.googleplay_caption ?? "Get it on"}
                    </span>
                    <span className="block text-base font-semibold text-white">
                      {props.googleplay_label ?? "Google Play"}
                    </span>
                  </span>
                </a>
              </div>

              {/* Rating line — stars + review count */}
              {(props.rating_value || props.rating_caption) && (
                <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
                  <span className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="h-4 w-4"
                        style={{ color: accent }}
                        fill={accent}
                      />
                    ))}
                  </span>
                  {props.rating_value && (
                    <span className="text-sm font-bold text-white">
                      {props.rating_value}
                    </span>
                  )}
                  {props.rating_caption && (
                    <span className="text-sm text-white/60">
                      {props.rating_caption}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT: phone mockup shell ─────────────────────────── */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                {/* Halo behind the phone */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-[3rem] blur-3xl"
                  style={{ backgroundColor: `${accent}40` }}
                />
                {/* Phone shell */}
                <div
                  className="relative mx-auto h-[540px] w-[270px] rounded-[2.75rem] border-[10px] border-black/80 bg-black p-2 shadow-2xl"
                  style={{ boxShadow: `0 40px 80px -24px ${accent}66` }}
                >
                  {/* Notch */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 top-3 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-black"
                  />
                  {/* Screen */}
                  <div
                    className="relative h-full w-full overflow-hidden rounded-[2.1rem]"
                    style={{ background: theme.card }}
                  >
                    {props.screenshot_url ? (
                      <Image
                        src={props.screenshot_url}
                        alt={props.phone_caption ?? "App screenshot"}
                        fill
                        sizes="270px"
                        className="object-cover"
                      />
                    ) : (
                      // Accent-tinted placeholder "screen"
                      <div
                        className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center"
                        style={{
                          background: `radial-gradient(120% 80% at 50% 0%, ${accent}40 0%, transparent 70%)`,
                        }}
                      >
                        <span
                          className="inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
                          style={{ backgroundColor: accent }}
                        >
                          <Smartphone className="h-8 w-8 text-white" />
                        </span>
                        {props.phone_caption && (
                          <p className="text-sm font-medium text-white/80">
                            {props.phone_caption}
                          </p>
                        )}
                        <div className="mt-2 w-full space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="h-3 rounded-full bg-white/10"
                              style={{ width: `${90 - i * 18}%`, margin: "0 auto" }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            FEATURES — 3-up grid with icon tiles
            ================================================================ */}
        {features.length > 0 && (
          <section className="scroll-mt-20 py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {props.features_title ?? "Built for your pocket"}
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
                    style={{ background: theme.card, borderColor: `${accent}33` }}
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
            TESTIMONIAL — short single quote
            ================================================================ */}
        {props.testimonial_quote && (
          <section className="px-4 pb-4 md:pb-8">
            <div className="mx-auto max-w-3xl">
              <figure
                className="rounded-3xl border p-8 text-center shadow-xl md:p-10"
                style={{ background: theme.card, borderColor: `${accent}33` }}
              >
                <span className="flex items-center justify-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      style={{ color: accent }}
                      fill={accent}
                    />
                  ))}
                </span>
                <blockquote className="mt-4 font-sora text-xl font-semibold leading-snug text-white sm:text-2xl">
                  &ldquo;{props.testimonial_quote}&rdquo;
                </blockquote>
                {(props.testimonial_author || props.testimonial_role) && (
                  <figcaption className="mt-4 text-sm text-white/65">
                    {props.testimonial_author && (
                      <span className="font-semibold text-white">
                        {props.testimonial_author}
                      </span>
                    )}
                    {props.testimonial_author && props.testimonial_role && " · "}
                    {props.testimonial_role}
                  </figcaption>
                )}
              </figure>
            </div>
          </section>
        )}

        {/* ================================================================
            EMAIL CAPTURE — white form card (legible inputs)
            ================================================================ */}
        <section id="get" className="scroll-mt-20 px-4 pb-16 pt-12 md:pb-24">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {props.capture_title ?? "Get the download link"}
              </h2>
              {props.capture_subtitle && (
                <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-white/70">
                  {props.capture_subtitle}
                </p>
              )}
            </div>

            {/* Form card stays white so inputs + labels are always legible. */}
            <div
              className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-7"
              style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
            >
              <div className="mb-4 text-center">
                <p
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  <Download className="h-3 w-3" />
                  Instant download link
                </p>
              </div>

              {props.pageId && !props.isPreview ? (
                <LeadCaptureForm
                  pageId={props.pageId}
                  ctaLabel={captureCta}
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
        </section>

        {/* Footer */}
        <SecureFooter accent={accent} variant="lite" />

        {/* Sticky mobile CTA → scrolls to the capture form */}
        <StickyFormCta
          label={props.sticky_cta ?? "Get the app"}
          accent={accent}
          targetId="get"
        />
      </div>
    </div>
  );
}
