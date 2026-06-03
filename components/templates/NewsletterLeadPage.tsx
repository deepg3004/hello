"use client";

import { Check, Lock, Mail, Sparkles, Star } from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { BgAnimation } from "./BgAnimation";
import { tgTheme } from "@/lib/telegram-themes";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { StickyFormCta } from "@/components/templates/shared/StickyFormCta";
import type { BaseTemplateProps } from "./shared/types";

interface BulletItem {
  text: string;
}

export interface NewsletterLeadPageProps extends BaseTemplateProps {
  badge_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  /** Heading above the "what you'll get" bullet list. */
  perks_title?: string;
  perks_items?: BulletItem[];
  /** Social-proof strip count, e.g. "10,000+". */
  proof_count?: string;
  /** Label after the count, e.g. "readers every week". */
  proof_label?: string;
  optin_cta?: string;
  /** Small heading inside the white form card. */
  form_title?: string;
  optin_privacy?: string;
  /** URL the subscriber is sent to after submitting (optional). */
  redirect_url?: string;
  /** Theme key (see lib/telegram-themes). Defaults to "telegram". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

export function NewsletterLeadPage(props: NewsletterLeadPageProps) {
  const perks = props.perks_items ?? [];
  const heroCta = props.optin_cta ?? "Subscribe — it's free";
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  // Small set of avatar tints derived from the accent so the social-proof
  // strip never looks empty even with no real subscriber images.
  const avatarTints = [`${accent}`, `${accent}cc`, `${accent}99`, `${accent}66`];

  return (
    <div className="relative min-h-screen text-zinc-100" style={{ background: theme.bg }}>
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10 isolate overflow-hidden pb-24 md:pb-0">
        {/* Accent wash behind the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
          style={{
            background: `radial-gradient(70% 80% at 50% 0%, ${accent}26 0%, transparent 70%)`,
          }}
        />

        {/* ==================================================================
            HERO — badge, headline, subheadline (centered single column)
            ================================================================== */}
        <section className="mx-auto max-w-2xl px-4 pb-2 pt-16 text-center sm:pt-24">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <Mail className="h-3 w-3" />
            {props.badge_text ?? "Free Newsletter"}
          </span>

          <h1 className="mt-6 font-sora text-[40px] font-bold leading-[1.1] tracking-tight text-white sm:text-[52px]">
            {props.hero_headline}
          </h1>

          {props.hero_subheadline && (
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              {props.hero_subheadline}
            </p>
          )}
        </section>

        {/* ==================================================================
            SOCIAL-PROOF STRIP — avatars + count
            ================================================================== */}
        {(props.proof_count || props.proof_label) && (
          <section className="mx-auto max-w-2xl px-4 pb-10 pt-6">
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <div className="flex -space-x-2">
                {avatarTints.map((tint, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/20 shadow-sm"
                    style={{ backgroundColor: tint }}
                  />
                ))}
              </div>
              <div className="flex flex-col items-center gap-1 sm:items-start">
                <span className="flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-current"
                      style={{ color: accent }}
                    />
                  ))}
                </span>
                <p className="text-sm text-zinc-300">
                  {props.proof_count && (
                    <span className="font-bold text-white">{props.proof_count} </span>
                  )}
                  {props.proof_label ?? "subscribers"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================
            WHAT YOU'LL GET EACH WEEK — accent ✓ bullet list
            ================================================================== */}
        {perks.length > 0 && (
          <section className="mx-auto max-w-xl px-4 pb-8">
            <div
              className="rounded-2xl border p-6 shadow-2xl md:p-8"
              style={{ background: theme.card, borderColor: `${accent}33` }}
            >
              <h2 className="font-sora text-lg font-bold tracking-tight text-white">
                {props.perks_title ?? "What you'll get each week"}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {perks.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                      style={{ backgroundColor: accent }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-zinc-300">{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ==================================================================
            OPT-IN FORM CARD (white surface for legible inputs)
            ================================================================== */}
        <section id="get" className="mx-auto max-w-sm scroll-mt-8 px-4 pb-16">
          <div
            className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl"
            style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
          >
            <div className="mb-4 text-center">
              <p
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Sparkles className="h-3 w-3" />
                Join the list
              </p>
              <h2 className="mt-2 font-sora text-lg font-bold tracking-tight text-zinc-900">
                {props.form_title ?? "Get the next issue in your inbox"}
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
        </section>

        {/* Powered-by footer */}
        <SecureFooter accent={accent} variant="lite" />

        <StickyFormCta label={heroCta} accent={accent} targetId="get" />
      </div>
    </div>
  );
}
