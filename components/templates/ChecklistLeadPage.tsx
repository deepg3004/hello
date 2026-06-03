"use client";

import { Check, ClipboardCheck, ListChecks, Lock, Sparkles } from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { BgAnimation } from "./BgAnimation";
import { tgTheme } from "@/lib/telegram-themes";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { StickyFormCta } from "@/components/templates/shared/StickyFormCta";
import type { BaseTemplateProps } from "./shared/types";

interface ChecklistItem {
  text: string;
}

interface WhyPoint {
  title: string;
  body: string;
}

export interface ChecklistLeadPageProps extends BaseTemplateProps {
  badge_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  optin_cta?: string;
  optin_privacy?: string;
  /** URL the buyer is sent to after submitting — usually the download. */
  redirect_url?: string;
  preview_title?: string;
  preview_label?: string;
  /** Sample checklist items rendered as a preview "what you'll get" card. */
  checklist_items?: ChecklistItem[];
  why_title?: string;
  why_points?: WhyPoint[];
  /** Theme key (see lib/telegram-themes). Defaults to "emerald". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

export function ChecklistLeadPage(props: ChecklistLeadPageProps) {
  const items = props.checklist_items ?? [];
  const why = props.why_points ?? [];
  const heroCta = props.optin_cta ?? "Send me the checklist";
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
            background: `radial-gradient(60% 80% at 75% 0%, ${accent}26 0%, transparent 70%)`,
          }}
        />

        {/* ==================================================================
            HERO — two columns: opt-in (left) + checklist preview (right)
            ================================================================== */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 pb-16 pt-14 sm:pt-20 lg:grid-cols-2 lg:gap-14">
          {/* ── LEFT: opt-in ─────────────────────────────────────────── */}
          <div id="get" className="scroll-mt-8 lg:sticky lg:top-12">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <ClipboardCheck className="h-3 w-3" />
              {props.badge_text ?? "Free Checklist"}
            </span>

            <h1 className="mt-6 font-sora text-[38px] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                {props.hero_subheadline}
              </p>
            )}

            {/* Opt-in form card — stays a WHITE surface so the inputs and
                labels are always legible; only the accent goes themed. */}
            <div
              className="mt-8 rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl"
              style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
            >
              <div className="mb-4">
                <p
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  <Sparkles className="h-3 w-3" />
                  Get instant access
                </p>
                <h2 className="mt-2 font-sora text-lg font-bold tracking-tight text-zinc-900">
                  Where should we send it?
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
              <p className="mt-4 text-center text-xs text-zinc-400 lg:text-left">
                {props.optin_privacy}
              </p>
            )}
          </div>

          {/* ── RIGHT: checklist preview ─────────────────────────────── */}
          <div className="lg:pt-10">
            <div
              className="relative rounded-2xl border p-6 shadow-2xl md:p-8"
              style={{ background: theme.card, borderColor: `${accent}33` }}
            >
              {/* Notebook-style header */}
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${accent}26`, color: accent }}
                >
                  <ListChecks className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-sora text-lg font-bold tracking-tight text-white">
                    {props.preview_title ?? "Inside the checklist"}
                  </h2>
                  {props.preview_label && (
                    <p className="mt-0.5 text-xs text-zinc-400">{props.preview_label}</p>
                  )}
                </div>
              </div>

              {/* Sample checklist items with accent-tinted check icons */}
              <ul className="mt-6 space-y-3">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 text-sm"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white shadow-sm"
                      style={{ backgroundColor: accent }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-zinc-200">{item.text}</span>
                  </li>
                ))}
              </ul>

              {/* Faded "...and more" hint so it reads as a preview */}
              <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                <span className="h-px flex-1" style={{ background: `${accent}33` }} />
                + more inside
                <span className="h-px flex-1" style={{ background: `${accent}33` }} />
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            "Why this checklist helps" — 3-point strip
            ================================================================== */}
        {why.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-16">
            {props.why_title && (
              <h2 className="text-center font-sora text-xl font-bold tracking-tight text-white sm:text-2xl">
                {props.why_title}
              </h2>
            )}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {why.map((p, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-6 text-center shadow-xl"
                  style={{ background: theme.card, borderColor: `${accent}1f` }}
                >
                  <span
                    aria-hidden
                    className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: accent }}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <h3 className="mt-4 font-sora text-base font-bold tracking-tight text-white">
                    {p.title}
                  </h3>
                  {p.body && (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
                  )}
                </div>
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
