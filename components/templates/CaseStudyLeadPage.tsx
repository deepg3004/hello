"use client";

import { ArrowUpRight, BarChart3, Check, FileText, Lock, Sparkles } from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { BgAnimation } from "./BgAnimation";
import { tgTheme } from "@/lib/telegram-themes";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { StickyFormCta } from "@/components/templates/shared/StickyFormCta";
import type { BaseTemplateProps } from "./shared/types";

interface DiscoverBullet {
  text: string;
}

interface TrustLogo {
  name: string;
}

export interface CaseStudyLeadPageProps extends BaseTemplateProps {
  badge_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  /** "What you'll discover" intro label above the bullet list. */
  discover_title?: string;
  /** Accent-checked bullet list of what's inside the case study. */
  discover_bullets?: DiscoverBullet[];
  /** Small result-stat callout, e.g. "312%" + "How Acme grew revenue". */
  stat_value?: string;
  stat_label?: string;
  /** Opt-in card copy. */
  form_eyebrow?: string;
  form_title?: string;
  optin_cta?: string;
  optin_privacy?: string;
  /** URL the lead is sent to after submitting — usually the download. */
  redirect_url?: string;
  /** Trust / logos strip. */
  logos_title?: string;
  trust_logos?: TrustLogo[];
  /** Theme key (see lib/telegram-themes). Defaults to "emerald". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

export function CaseStudyLeadPage(props: CaseStudyLeadPageProps) {
  const bullets = props.discover_bullets ?? [];
  const logos = props.trust_logos ?? [];
  const heroCta = props.optin_cta ?? "Get the case study";
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div className="relative min-h-screen text-zinc-100" style={{ background: theme.bg }}>
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10 isolate overflow-hidden pb-24 md:pb-0">
        {/* Subtle accent wash behind the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh]"
          style={{
            background: `radial-gradient(55% 80% at 25% 0%, ${accent}26 0%, transparent 70%)`,
          }}
        />

        {/* ==================================================================
            HERO — two columns: value pitch (left) + opt-in card (right)
            ================================================================== */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          {/* ── LEFT: value pitch ────────────────────────────────────── */}
          <div className="lg:pt-6">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <FileText className="h-3 w-3" />
              {props.badge_text ?? "Free case study"}
            </span>

            <h1 className="mt-6 font-sora text-[38px] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                {props.hero_subheadline}
              </p>
            )}

            {/* "What you'll discover" bullet list with accent checks */}
            {bullets.length > 0 && (
              <div className="mt-8">
                {props.discover_title && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    {props.discover_title}
                  </p>
                )}
                <ul className="mt-4 space-y-3">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white shadow-sm"
                        style={{ backgroundColor: accent }}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-zinc-200">{b.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Result-stat callout */}
            {(props.stat_value || props.stat_label) && (
              <div
                className="mt-8 flex items-center gap-4 rounded-2xl border p-5 shadow-xl"
                style={{ background: theme.card, borderColor: `${accent}33` }}
              >
                <span
                  aria-hidden
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${accent}26`, color: accent }}
                >
                  <BarChart3 className="h-5 w-5" />
                </span>
                <div>
                  {props.stat_value && (
                    <p className="font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {props.stat_value}
                    </p>
                  )}
                  {props.stat_label && (
                    <p className="mt-0.5 text-sm text-zinc-400">{props.stat_label}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: opt-in card ───────────────────────────────────── */}
          <div id="get" className="scroll-mt-8 lg:sticky lg:top-12">
            {/* Opt-in form card — stays a WHITE surface so the inputs and
                labels are always legible; only the accent goes themed. */}
            <div
              className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl sm:p-7"
              style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
            >
              <div className="mb-4">
                <p
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  <Sparkles className="h-3 w-3" />
                  {props.form_eyebrow ?? "Instant access"}
                </p>
                <h2 className="mt-2 font-sora text-lg font-bold tracking-tight text-zinc-900">
                  {props.form_title ?? "Get your free copy"}
                </h2>
              </div>

              {props.pageId && !props.isPreview ? (
                <LeadCaptureForm
                  pageId={props.pageId}
                  ctaLabel={heroCta}
                  requirePhone={false}
                  redirectUrl={props.redirect_url}
                  formConfig={props.formConfig}
                  primaryColor={accent}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                  Opt-in form renders on the live page.
                </p>
              )}

              <div className="mt-4 border-t border-zinc-100 pt-3">
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <Lock className="h-3 w-3" />
                  No spam · Unsubscribe anytime · 100% free
                </p>
              </div>
            </div>

            {props.optin_privacy && (
              <p className="mt-4 text-center text-xs text-zinc-400">{props.optin_privacy}</p>
            )}
          </div>
        </section>

        {/* ==================================================================
            Logos / trust strip
            ================================================================== */}
        {logos.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-16">
            {props.logos_title && (
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {props.logos_title}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              {logos.map((l, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-base font-bold tracking-tight text-zinc-300"
                >
                  <ArrowUpRight className="h-4 w-4" style={{ color: accent }} />
                  {l.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Tiny powered-by footer strip */}
        <SecureFooter accent={accent} variant="lite" />

        <StickyFormCta label={heroCta} accent={accent} targetId="get" />
      </div>
    </div>
  );
}
