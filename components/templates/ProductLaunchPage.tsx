"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Lock,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { tgTheme } from "@/lib/telegram-themes";
import { BgAnimation } from "./BgAnimation";
import { Countdown } from "./shared/Countdown";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import type { BaseTemplateProps } from "./shared/types";

interface FeatureItem {
  /** Optional emoji / short glyph rendered in the icon tile. */
  icon?: string;
  title: string;
  description?: string;
}

interface StepItem {
  title: string;
  description?: string;
}

interface StatItem {
  /** Big number / value, e.g. "12,400" or "4.9★". */
  value: string;
  label?: string;
}

export interface ProductLaunchPageProps extends BaseTemplateProps {
  // ── Hero ──────────────────────────────────────────────
  hero_eyebrow?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;

  // ── Features / benefits grid ──────────────────────────
  features_title?: string;
  features_subtitle?: string;
  features?: FeatureItem[];

  // ── How it works ──────────────────────────────────────
  steps_title?: string;
  steps?: StepItem[];

  // ── Social proof / stats strip ────────────────────────
  proof_title?: string;
  stats?: StatItem[];

  // ── Email capture ─────────────────────────────────────
  capture_title?: string;
  capture_subtitle?: string;
  capture_cta?: string;
  capture_privacy?: string;
  /** Optional URL the lead is redirected to after submitting. */
  redirect_url?: string;

  // ── Sticky mobile bar ─────────────────────────────────
  sticky_cta?: string;

  // ── Launch countdown ──────────────────────────────────
  countdown_enabled?: boolean;
  countdown_target?: string;
  countdown_label?: string;

  // ── Design ────────────────────────────────────────────
  /** Seller-pickable colour theme (dark gradient bg + accent). */
  theme_key?: string;
  /** Optional ambient background animation. */
  bg_animation?: string;
}

export function ProductLaunchPage(props: ProductLaunchPageProps) {
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  const features = props.features ?? [];
  const steps = props.steps ?? [];
  const stats = props.stats ?? [];

  const showCountdown = !!props.countdown_enabled && !!props.countdown_target;

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

      <div className="relative z-10">
        {/* ================================================================
            HERO — eyebrow, headline, subheadline, CTA, optional countdown
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

          <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-24 text-center md:pt-28">
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

            <h1 className="mt-6 font-sora text-[42px] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[68px]">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-xl">
                {props.hero_subheadline}
              </p>
            )}

            {showCountdown && (
              <div className="mt-8 flex justify-center">
                <Countdown
                  targetIso={props.countdown_target as string}
                  label={props.countdown_label ?? "Launching in"}
                  boxClassName="bg-white/10 text-white backdrop-blur"
                />
              </div>
            )}

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="#capture"
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:scale-105 hover:opacity-90"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 18px 40px -12px ${accent}80`,
                }}
              >
                <Rocket className="h-4 w-4" strokeWidth={2.5} />
                {props.hero_cta ?? "Get early access"}
              </a>
              {features.length > 0 && (
                <a
                  href="#features"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
                >
                  See what&apos;s inside
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================
            FEATURES / BENEFITS — 3-up grid with icon tiles
            ================================================================ */}
        {features.length > 0 && (
          <section id="features" className="scroll-mt-20 py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {props.features_title ?? "Everything you need to launch"}
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
            HOW IT WORKS — 3-step strip
            ================================================================ */}
        {steps.length > 0 && (
          <section
            className="border-y border-white/10 py-16 md:py-24"
            style={{ backgroundColor: `${theme.card}80` }}
          >
            <div className="mx-auto max-w-6xl px-4">
              <h2 className="text-center font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {props.steps_title ?? "How it works"}
              </h2>

              <ol className="mt-12 grid gap-8 md:grid-cols-3">
                {steps.map((s, i) => (
                  <li key={i} className="relative text-center md:text-left">
                    <span
                      aria-hidden
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full font-sora text-lg font-bold text-white shadow-lg"
                      style={{ backgroundColor: accent }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="mt-4 font-sora text-lg font-bold tracking-tight text-white">
                      {s.title}
                    </h3>
                    {s.description && (
                      <p className="mt-2 text-sm leading-relaxed text-white/65">
                        {s.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* ================================================================
            SOCIAL PROOF / STATS STRIP
            ================================================================ */}
        {stats.length > 0 && (
          <section className="py-16 md:py-20">
            <div className="mx-auto max-w-5xl px-4 text-center">
              {props.proof_title && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {props.proof_title}
                </p>
              )}
              <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
                {stats.map((s, i) => (
                  <div key={i}>
                    <p
                      className="font-sora text-4xl font-bold tracking-tight sm:text-5xl"
                      style={{ color: accent }}
                    >
                      {s.value}
                    </p>
                    {s.label && (
                      <p className="mt-2 text-sm font-medium text-white/65">
                        {s.label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            EMAIL CAPTURE — white form card (legible inputs)
            ================================================================ */}
        <section
          id="capture"
          className="scroll-mt-20 px-4 pb-28 pt-8 md:pb-24"
        >
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <h2 className="font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {props.capture_title ?? "Be first in line"}
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
                  Early access list
                </p>
              </div>

              {props.pageId && !props.isPreview ? (
                <LeadCaptureForm
                  pageId={props.pageId}
                  ctaLabel={props.capture_cta ?? "Notify me at launch"}
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
      </div>

      {/* ================================================================
          STICKY MOBILE CTA — scrolls to the capture form
          ================================================================ */}
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden",
          stickyVisible ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ backgroundColor: `${theme.card}f2` }}
      >
        <a
          href="#capture"
          className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <Rocket className="h-4 w-4" strokeWidth={2.5} />
          {props.sticky_cta ?? props.hero_cta ?? "Get early access"}
        </a>
      </div>
    </div>
  );
}
