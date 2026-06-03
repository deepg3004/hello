"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  Check,
  Clock,
  Flame,
  Lock,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { tgTheme } from "@/lib/telegram-themes";
import { BgAnimation } from "./BgAnimation";
import { Countdown } from "./shared/Countdown";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import type { BaseTemplateProps } from "./shared/types";

interface ValueItem {
  text: string;
  /** Optional crossed-out worth, e.g. "$97 value". */
  worth?: string;
}

interface ReasonItem {
  /** The "before" / pain state. */
  before: string;
  /** The "after" / desired state once they take the offer. */
  after: string;
}

interface FaqItem {
  q: string;
  a: string;
}

export interface SalesPromoPageProps extends BaseTemplateProps {
  /** Top urgency banner. */
  urgency_enabled?: boolean;
  urgency_text?: string;

  /** Hero. */
  badge_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  /** ISO date the offer ends — drives the countdown. */
  offer_ends_at?: string;
  countdown_label?: string;

  /** Value stack. */
  value_title?: string;
  value_items?: ValueItem[];
  value_total_label?: string;

  /** "Why now" / before-after reasons. */
  reasons_title?: string;
  reasons_items?: ReasonItem[];

  /** FAQ. */
  faq_title?: string;
  faq_items?: FaqItem[];

  /** Email-capture card. */
  capture_eyebrow?: string;
  capture_title?: string;
  capture_subtitle?: string;
  capture_cta?: string;
  capture_privacy?: string;
  /** Optional redirect after submit. */
  redirect_url?: string;

  /** Sticky mobile bar. */
  sticky_cta?: string;

  /** Seller-pickable colour theme. */
  theme_key?: string;
  /** Optional ambient background animation. */
  bg_animation?: string;
}

export function SalesPromoPage(props: SalesPromoPageProps) {
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  const valueItems = props.value_items ?? [];
  const reasons = props.reasons_items ?? [];
  const faqs = props.faq_items ?? [];

  const heroCta = props.hero_cta ?? "Claim the offer";
  const stickyCta = props.sticky_cta ?? heroCta;

  // Sticky bottom CTA appears once the user scrolls past the hero.
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 360);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen text-zinc-100" style={{ background: theme.bg }}>
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10 pb-24 md:pb-0">
        {/* ==============================================================
            URGENCY BANNER
            ============================================================== */}
        {props.urgency_enabled && props.urgency_text && (
          <div
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            <Flame className="h-4 w-4 animate-pulse-slow" />
            <span className="tracking-tight">{props.urgency_text}</span>
          </div>
        )}

        {/* ==============================================================
            HERO — offer headline + countdown + CTA
            ============================================================== */}
        <section className="relative isolate overflow-hidden">
          {/* Accent glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}33` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-40 h-[340px] w-[340px] rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}26` }}
          />

          <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-16 text-center sm:pt-20">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg"
              style={{ backgroundColor: accent, boxShadow: `0 10px 30px -10px ${accent}` }}
            >
              <BadgePercent className="h-3.5 w-3.5" />
              {props.badge_text ?? "Limited-Time Offer"}
            </span>

            <h1 className="mt-6 font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[56px]">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                {props.hero_subheadline}
              </p>
            )}

            {/* Prominent countdown */}
            {props.offer_ends_at && (
              <div className="mt-9 flex flex-col items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-300">
                  <Clock className="h-3.5 w-3.5" style={{ color: accent }} />
                  {props.countdown_label ?? "Offer ends in"}
                </span>
                <div
                  className="rounded-2xl border p-4 shadow-2xl"
                  style={{
                    background: theme.card,
                    borderColor: `${accent}99`,
                    boxShadow: `0 25px 50px -12px ${accent}40`,
                  }}
                >
                  <Countdown
                    targetIso={props.offer_ends_at}
                    boxClassName="text-white"
                    digitClassName="text-3xl font-bold tabular-nums"
                  />
                </div>
              </div>
            )}

            <div className="mt-9">
              <a
                href="#claim"
                className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-xl transition hover:scale-[1.03] hover:opacity-95"
                style={{ backgroundColor: accent, boxShadow: `0 18px 40px -12px ${accent}` }}
              >
                <Zap className="h-5 w-5" strokeWidth={2.5} />
                {heroCta}
              </a>
            </div>
          </div>
        </section>

        {/* ==============================================================
            VALUE STACK — what you get
            ============================================================== */}
        {valueItems.length > 0 && (
          <section className="mx-auto max-w-2xl px-4 py-10">
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {props.value_title ?? "Here's everything you get"}
            </h2>
            <ul className="mt-7 space-y-3">
              {valueItems.map((v, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-4 rounded-xl border p-4 shadow-lg"
                  style={{ background: theme.card, borderColor: `${accent}33` }}
                >
                  <span className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                      style={{ backgroundColor: accent }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium text-zinc-100 sm:text-base">
                      {v.text}
                    </span>
                  </span>
                  {v.worth && (
                    <span className="shrink-0 text-sm font-semibold text-zinc-500 line-through">
                      {v.worth}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {props.value_total_label && (
              <p
                className="mx-auto mt-6 w-fit rounded-full border px-5 py-2 text-center text-sm font-bold tracking-tight"
                style={{
                  borderColor: `${accent}99`,
                  backgroundColor: `${accent}26`,
                  color: "#fff",
                }}
              >
                {props.value_total_label}
              </p>
            )}
          </section>
        )}

        {/* ==============================================================
            WHY NOW — before / after reasons
            ============================================================== */}
        {reasons.length > 0 && (
          <section className="mx-auto max-w-4xl px-4 py-12">
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {props.reasons_title ?? "Why act now"}
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {reasons.map((r, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-5 shadow-lg"
                  style={{ background: theme.card, borderColor: `${accent}33` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <p className="text-sm leading-relaxed text-zinc-400 line-through decoration-rose-400/40">
                      {r.before}
                    </p>
                  </div>
                  <div className="mt-3 flex items-start gap-3 border-t border-white/10 pt-3">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: accent }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <p className="text-sm font-medium leading-relaxed text-zinc-100">
                      {r.after}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ==============================================================
            FAQ
            ============================================================== */}
        {faqs.length > 0 && (
          <section className="mx-auto max-w-2xl px-4 py-12">
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {props.faq_title ?? "Questions, answered"}
            </h2>
            <div className="mt-7 space-y-3">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-xl border p-5 shadow-sm transition"
                  style={{ background: theme.card, borderColor: `${accent}26` }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-sora text-sm font-semibold text-white">
                    {f.q}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90"
                      style={{ color: accent }}
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ==============================================================
            EMAIL CAPTURE — white form card
            ============================================================== */}
        <section id="claim" className="mx-auto max-w-md scroll-mt-8 px-4 py-14">
          <div
            className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-8"
            style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
          >
            <div className="mb-4 text-center">
              <p
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Sparkles className="h-3 w-3" />
                {props.capture_eyebrow ?? "Lock in this price"}
              </p>
              <h2 className="mt-2 font-sora text-xl font-bold tracking-tight text-zinc-900">
                {props.capture_title ?? "Claim your spot"}
              </h2>
              {props.capture_subtitle && (
                <p className="mt-1 text-sm text-zinc-500">{props.capture_subtitle}</p>
              )}
            </div>

            {props.pageId && !props.isPreview ? (
              <LeadCaptureForm
                pageId={props.pageId}
                ctaLabel={props.capture_cta ?? "Claim the offer"}
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
            <p className="mt-4 text-center text-xs text-zinc-400">{props.capture_privacy}</p>
          )}
        </section>

        {/* Footer */}
        <SecureFooter accent={accent} variant="lite" />
      </div>

      {/* ==============================================================
          STICKY BOTTOM CTA (mobile)
          ============================================================== */}
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden",
          stickyVisible ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ backgroundColor: `${theme.card}f2` }}
      >
        <a
          href="#claim"
          className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-bold text-white shadow-lg transition active:scale-[0.98]"
          style={{ backgroundColor: accent }}
        >
          <Zap className="h-5 w-5" strokeWidth={2.5} />
          {stickyCta}
        </a>
      </div>
    </div>
  );
}
