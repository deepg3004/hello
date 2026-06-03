"use client";

import { Check, Gift, Lock, Sparkles } from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { BgAnimation } from "./BgAnimation";
import { tgTheme } from "@/lib/telegram-themes";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { StickyFormCta } from "@/components/templates/shared/StickyFormCta";
import type { BaseTemplateProps } from "./shared/types";

interface BulletItem {
  text: string;
}

export interface FreebieLeadPageProps extends BaseTemplateProps {
  badge_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  inside_title?: string;
  inside_items?: BulletItem[];
  optin_cta?: string;
  optin_privacy?: string;
  /** URL the buyer is sent to after submitting — usually the download. */
  redirect_url?: string;
  /** Optional product mockup image. When absent we render a CSS-built
   *  "book cover" / "folder" visual so the page never looks empty. */
  hero_image?: string;
  /** Short label shown on the CSS book cover (e.g. "EBOOK", "GUIDE"). */
  product_label?: string;
  /** Theme key (see lib/telegram-themes). Defaults to "sunset". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

export function FreebieLeadPage(props: FreebieLeadPageProps) {
  const inside = props.inside_items ?? [];
  const heroCta = props.optin_cta ?? "Send it to me";
  const productLabel = (props.product_label ?? "FREE GUIDE").toUpperCase();
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div className="relative min-h-screen text-zinc-100" style={{ background: theme.bg }}>
      <BgAnimation type={props.bg_animation} />

      <div className="relative z-10 isolate overflow-hidden pb-24 md:pb-0">
        {/* Subtle accent wash behind the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
          style={{
            background: `radial-gradient(60% 80% at 50% 0%, ${accent}26 0%, transparent 70%)`,
          }}
        />

        {/* ==================================================================
            HERO — badge, headline, mockup
            ================================================================== */}
        <section className="mx-auto max-w-2xl px-4 pb-10 pt-16 text-center sm:pt-20">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <Gift className="h-3 w-3" />
            {props.badge_text ?? "Free Download"}
          </span>

          <h1 className="mt-6 font-sora text-[40px] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            {props.hero_headline}
          </h1>

          {props.hero_subheadline && (
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              {props.hero_subheadline}
            </p>
          )}

          {/* Mockup — image OR CSS book cover */}
          <div className="mx-auto mt-10 max-w-sm">
            {props.hero_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={props.hero_image}
                alt={props.hero_headline}
                className="aspect-[3/4] w-full rounded-2xl object-cover shadow-2xl shadow-black/40"
              />
            ) : (
              <BookCover label={productLabel} title={props.hero_headline} accent={accent} />
            )}
          </div>
        </section>

        {/* ==================================================================
            "What's inside" — accent ✓ bullet list
            ================================================================== */}
        {inside.length > 0 && (
          <section className="mx-auto max-w-2xl px-4 pb-8">
            <div
              className="rounded-2xl border p-6 shadow-2xl md:p-8"
              style={{ background: theme.card, borderColor: `${accent}33` }}
            >
              <h2 className="font-sora text-lg font-bold tracking-tight text-white">
                {props.inside_title ?? "What's inside"}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {inside.map((b, i) => (
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
            OPT-IN FORM CARD
            ================================================================== */}
        <section
          id="get"
          className="mx-auto max-w-sm scroll-mt-8 px-4 pb-16"
        >
          {/* The form card stays light (white surface, dark text) so the
              opt-in inputs + labels are always legible; only the accent and
              the surrounding page go dark-themed. */}
          <div
            className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl"
            style={{ boxShadow: `0 25px 50px -12px ${accent}40` }}
          >
            {/* Title above form */}
            <div className="mb-4 text-center">
              <p
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Sparkles className="h-3 w-3" />
                Send it to my inbox
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

            {/* Trust row */}
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                <Lock className="h-3 w-3" />
                No spam · Unsubscribe anytime · 100% free
              </p>
            </div>
          </div>

          {props.optin_privacy && (
            <p className="mt-4 text-center text-xs text-zinc-400">
              {props.optin_privacy}
            </p>
          )}
        </section>

        {/* Tiny powered-by footer strip */}
        <SecureFooter accent={accent} variant="lite" />

        <StickyFormCta label={heroCta} accent={accent} targetId="get" />
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

/**
 * CSS-built "book / folder" cover used when the seller hasn't uploaded a
 * mockup. Accent-tinted gradient face + paper-fold side stripe + the product
 * title embossed in the centre.
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
  // Truncate the title for the cover face — long marketing headlines look
  // weird embossed on a book.
  const coverTitle = title.length > 60 ? title.slice(0, 57).trim() + "…" : title;
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px]">
      {/* Drop shadow + slight 3D tilt */}
      <div
        className="absolute inset-0 -rotate-2 rounded-2xl shadow-2xl shadow-black/40 transition-transform duration-300 hover:rotate-0"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 45%, ${accent}80 100%)`,
        }}
      >
        {/* Paper-fold side stripe (page edges) */}
        <div
          aria-hidden
          className="absolute inset-y-3 left-0 w-2 rounded-l-lg"
          style={{
            background:
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.5) 0 2px, rgba(255,255,255,0) 2px 4px)",
          }}
        />
        {/* Highlight sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 50%)",
          }}
        />
        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-between px-5 py-6 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">
            {label}
          </p>
          <p className="text-center font-sora text-lg font-bold leading-snug">
            {coverTitle}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/70">
            invoxai.io
          </p>
        </div>
      </div>
    </div>
  );
}
