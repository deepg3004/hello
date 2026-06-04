"use client";

import { ArrowRight, Check, Star, X } from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { BgAnimation } from "./BgAnimation";
import { Countdown } from "./shared/Countdown";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { tgTheme } from "@/lib/telegram-themes";
import type { BaseTemplateProps } from "./shared/types";

interface Bullet {
  text: string;
}

export interface PaymentCoachingPageProps extends BaseTemplateProps {
  urgency_enabled?: boolean;
  urgency_text?: string;

  hero_headline: string;
  /** Small word/phrase rendered with an orange underline accent under the
   *  headline — defaults to the last word of the headline if not set. */
  hero_underline?: string;
  hero_subheadline?: string;
  hero_cta?: string;
  /** Photo of the coach (optional — falls back to a gradient placeholder). */
  coach_image?: string;
  coach_name?: string;

  /** "You will get" bullet list rendered under the hero copy. */
  wyg_title?: string;
  wyg_items?: Bullet[];

  /** Social-proof avatar bar: "Join 1,200+ professionals…" */
  social_proof_count?: number;
  social_proof_text?: string;
  /** Optional comma-separated initials list for the avatar stack
   *  (e.g. "PS, RK, AM, JT"). When absent we generate filler initials. */
  social_proof_initials?: string;

  metric1_value?: string;
  metric1_label?: string;
  metric2_value?: string;
  metric2_label?: string;
  metric3_value?: string;
  metric3_label?: string;

  /** "Is this for you?" two-column section */
  forme_title?: string;
  forme_yes_items?: Bullet[];
  forme_no_items?: Bullet[];

  // ── Legacy props (kept so existing page_configs and the current
  //   coaching template registry continue to render without changes) ─────
  /** Legacy: title for the original "Who this is for" section. Used as the
   *  `forme_title` fallback if the new prop isn't set. */
  who_title?: string;
  /** Legacy: bullets for the original "Who this is for" section. Used as
   *  the YES column items if `forme_yes_items` isn't set. */
  who_items?: Bullet[];

  checkout_title?: string;
  checkout_note?: string;

  /** Theme key (see lib/telegram-themes). Defaults to "sunset". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

export function PaymentCoachingPage(props: PaymentCoachingPageProps) {
  const wyg = props.wyg_items ?? [];
  // Prefer the new "is this for you?" YES/NO props; fall back to the legacy
  // who_items as the YES column so existing pages render unchanged.
  const yesItems = props.forme_yes_items ?? props.who_items ?? [];
  const noItems = props.forme_no_items ?? [];
  const formeTitle = props.forme_title ?? props.who_title;
  const timer = props.timer;
  const price = props.product?.price ?? 0;
  const heroCta = props.hero_cta ?? "Book a strategy call";

  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  const socialCount = props.social_proof_count ?? 1200;
  const socialText =
    props.social_proof_text ??
    `Join ${socialCount.toLocaleString("en-IN")}+ professionals`;
  const avatarInitials = (
    props.social_proof_initials ?? "PS,RK,AM,JT,SN"
  )
    .split(",")
    .map((s) => s.trim().toUpperCase().slice(0, 2))
    .filter(Boolean);

  // Split the headline so the last word (or the explicit hero_underline) gets
  // the orange underline accent. Keeps the editor simple — most users won't
  // need to set hero_underline.
  const headlineParts = splitHeadline(
    props.hero_headline,
    props.hero_underline,
  );

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />
      <div className="relative z-10">
      {/* ── Optional urgency strip ──────────────────────────────────── */}
      {props.urgency_enabled && props.urgency_text && (
        <div
          className="px-4 py-2 text-center text-sm font-semibold text-zinc-950"
          style={{ backgroundColor: accent }}
        >
          {props.urgency_text}
        </div>
      )}

      {/* ====================================================================
          HERO — split layout (text left, coach photo right)
          ==================================================================== */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-0 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}26` }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.1fr_minmax(0,1fr)] md:gap-12 md:pb-20 md:pt-16">
          <div>
            {timer?.enabled && timer.target && (
              <div className="mb-6">
                <Countdown
                  targetIso={timer.target}
                  label={timer.label ?? "Cohort closes in"}
                  boxClassName="bg-white/10 text-white"
                />
              </div>
            )}

            <h1 className="font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {headlineParts.head}
              {headlineParts.tail && (
                <>
                  <br />
                  <span className="relative inline-block">
                    {headlineParts.tail}
                    <span
                      aria-hidden
                      className="absolute -bottom-1.5 left-0 right-0 h-1.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                  </span>
                </>
              )}
            </h1>

            {props.hero_subheadline && (
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                {props.hero_subheadline}
              </p>
            )}

            {/* You will get — checkmark list */}
            {wyg.length > 0 && (
              <ul className="mt-6 space-y-2 text-base text-white/85">
                {wyg.slice(0, 6).map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-950"
                      style={{ backgroundColor: accent }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {b.text}
                  </li>
                ))}
              </ul>
            )}

            {/* CTA + social proof bar */}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="#book"
                className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white shadow-xl transition hover:scale-105 hover:opacity-90"
                style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accent}40` }}
              >
                {heroCta}
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </a>
              <AvatarStack
                initials={avatarInitials}
                label={socialText}
              />
            </div>
          </div>

          {/* Coach photo (placeholder gradient if not set) */}
          <div className="relative">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
              {props.coach_image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.coach_image}
                  alt={props.coach_name ?? "Coach"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-zinc-500"
                  style={{
                    background: `linear-gradient(135deg, ${accent}40, ${theme.card} 70%)`,
                  }}
                >
                  <span className="font-sora text-5xl font-bold text-white/30">
                    {(props.coach_name ?? "Coach")
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                </div>
              )}
            </div>
            {props.coach_name && (
              <div
                className="absolute -bottom-3 left-3 right-3 rounded-xl border border-white/10 px-4 py-3 backdrop-blur"
                style={{ backgroundColor: `${theme.card}f2` }}
              >
                <p className="font-sora text-sm font-semibold text-white">
                  {props.coach_name}
                </p>
                <div className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: accent }}>
                  <Star className="h-3 w-3 fill-current" />
                  <Star className="h-3 w-3 fill-current" />
                  <Star className="h-3 w-3 fill-current" />
                  <Star className="h-3 w-3 fill-current" />
                  <Star className="h-3 w-3 fill-current" />
                  <span className="ml-1 text-white/70">
                    Verified coach
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Metrics row ─────────────────────────────────────────────── */}
      {(props.metric1_value || props.metric2_value || props.metric3_value) && (
        <section className="border-y border-white/10 bg-black/30 py-10">
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-6 text-center md:grid-cols-3">
            {[
              [props.metric1_value, props.metric1_label],
              [props.metric2_value, props.metric2_label],
              [props.metric3_value, props.metric3_label],
            ].map(([v, l], i) =>
              v ? (
                <div key={i}>
                  <div className="font-sora text-3xl font-bold" style={{ color: accent }}>
                    {v}
                  </div>
                  <div className="text-sm text-zinc-400">{l}</div>
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* ====================================================================
          "Is this for you?" — two-column comparison
          ==================================================================== */}
      {(yesItems.length > 0 || noItems.length > 0) && (
        <section className="bg-black/20 py-16">
          <div className="mx-auto max-w-5xl px-6">
            {formeTitle && (
              <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {formeTitle}
              </h2>
            )}
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {/* YES column */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <h3 className="font-sora text-lg font-bold text-emerald-300">
                    This IS for you if…
                  </h3>
                </div>
                <ul className="space-y-3 text-sm text-white/85">
                  {yesItems.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>

              {/* NO column */}
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white">
                    <X className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <h3 className="font-sora text-lg font-bold text-rose-300">
                    This is NOT for you if…
                  </h3>
                </div>
                <ul className="space-y-3 text-sm text-white/75">
                  {noItems.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          CHECKOUT
          ==================================================================== */}
      <section
        id="book"
        className="scroll-mt-16 px-4 pb-32 pt-16 md:pb-20"
      >
        <div className="mx-auto max-w-3xl">
          {props.checkout_title && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {props.checkout_title}
            </h2>
          )}
          {props.checkout_note && (
            <p className="mt-2 text-center text-sm text-zinc-400">
              {props.checkout_note}
            </p>
          )}

          <div className="mt-8 rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-8">
            <div className="mb-5 flex items-baseline gap-2 border-b border-zinc-100 pb-4">
              <span className="font-sora text-4xl font-bold text-zinc-900">
                ₹{Number(price).toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-zinc-500">one-time</span>
            </div>

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
              <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                {props.isPreview
                  ? "Checkout form renders on the live page."
                  : "Attach a product to this page to enable checkout."}
              </p>
            )}

            <SecureFooter accent={accent} />
          </div>
        </div>
      </section>

      </div>

      <StickyCheckoutBar
        targetId="book"
        priceLabel={price ? `₹${price.toLocaleString("en-IN")}` : "Book"}
        cta={heroCta}
        buttonClassName="text-white"
        buttonStyle={{ backgroundColor: accent }}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function AvatarStack({
  initials,
  label,
}: {
  initials: string[];
  label: string;
}) {
  const palette = [
    "bg-orange-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-sky-500",
  ];
  return (
    <div className="inline-flex items-center gap-3">
      <div className="flex -space-x-2">
        {initials.slice(0, 5).map((init, i) => (
          <span
            key={i}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full",
              "border-2 border-zinc-900 text-[10px] font-bold text-white shadow-sm",
              palette[i % palette.length] ?? "bg-orange-500",
            ].join(" ")}
            style={{ zIndex: 10 - i }}
          >
            {init}
          </span>
        ))}
      </div>
      <span className="text-sm font-medium text-white/80">{label}</span>
    </div>
  );
}

function splitHeadline(
  headline: string,
  explicit?: string,
): { head: string; tail: string } {
  if (explicit && headline.includes(explicit)) {
    const i = headline.lastIndexOf(explicit);
    return {
      head: headline.slice(0, i).trim(),
      tail: explicit,
    };
  }
  const words = headline.trim().split(/\s+/);
  if (words.length < 2) return { head: "", tail: headline };
  const tail = words.slice(-2).join(" ");
  return {
    head: words.slice(0, -2).join(" "),
    tail,
  };
}
