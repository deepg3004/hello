"use client";

import {
  ArrowRight,
  Check,
  Crown,
  Lock,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { BgAnimation } from "./BgAnimation";
import { Stars } from "./shared/Stars";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import type { BaseTemplateProps } from "./shared/types";
import { tgTheme } from "@/lib/telegram-themes";

interface Perk {
  text: string;
  description?: string;
}
interface MemberTestimonial {
  quote: string;
  author: string;
  role?: string;
}

export interface MembershipPageProps extends BaseTemplateProps {
  hero_badge?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  hero_image?: string;

  perks_title?: string;
  perks_subtitle?: string;
  perks_items?: Perk[];

  whofor_label?: string;
  whofor_text?: string;

  proof_title?: string;
  member_count_label?: string;
  testimonials_items?: MemberTestimonial[];

  checkout_title?: string;
  checkout_billing_note?: string;
  checkout_features_title?: string;
  checkout_features?: Perk[];
  checkout_guarantee?: string;

  /** Theme key (see lib/telegram-themes). Defaults to "midnight". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

const FALLBACK_PRICE = 499;

export function MembershipPage(props: MembershipPageProps) {
  const perks = props.perks_items ?? [];
  const testimonials = props.testimonials_items ?? [];
  const features = props.checkout_features ?? [];

  const productName = props.product?.name ?? "Membership";
  const productPrice = props.product?.price ?? FALLBACK_PRICE;
  const productCurrency = props.product?.currency ?? "INR";

  const heroCta = props.hero_cta ?? "Join now";

  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{ background: theme.bg }}
    >
      <BgAnimation type={props.bg_animation} />

      {/* =====================================================================
          HERO — centered "members only" gate, badge + headline + CTA, with
          an optional framed member image card below. Deliberately different
          from the split course hero.
          ===================================================================== */}
      <section className="relative isolate z-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}26` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-20 text-center md:pb-20 md:pt-28">
          {props.hero_badge && (
            <span
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-white"
              style={{
                borderColor: `${accent}4d`,
                backgroundColor: `${accent}1a`,
              }}
            >
              <Crown className="h-3.5 w-3.5" style={{ color: accent }} />
              {props.hero_badge}
            </span>
          )}

          <h1 className="font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {props.hero_headline}
          </h1>

          {props.hero_subheadline && (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
              {props.hero_subheadline}
            </p>
          )}

          <a
            href="#join"
            style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accent}40` }}
            className="mt-8 inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-semibold text-white transition hover:scale-105 hover:opacity-90 sm:px-11 sm:text-lg"
          >
            {heroCta}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </a>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/60 md:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Members-only access
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Cancel anytime
            </span>
            <span className="opacity-40">•</span>
            <span>📱 UPI accepted</span>
          </div>

          {/* Framed member image / placeholder */}
          <div className="mx-auto mt-12 max-w-2xl">
            {props.hero_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={props.hero_image}
                alt={props.hero_headline}
                className="aspect-[16/9] w-full rounded-2xl border border-white/10 object-cover shadow-2xl"
                style={{ boxShadow: `0 24px 60px ${accent}26` }}
              />
            ) : (
              <div
                className="aspect-[16/9] w-full rounded-2xl border border-white/10 shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${accent}40, ${accent}1f 60%, ${theme.card})`,
                  boxShadow: `0 24px 60px ${accent}26`,
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          MAIN — single column content, checkout pinned on the right at lg
          ===================================================================== */}
      <div className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
            {/* ── LEFT (content) ─────────────────────────────────────── */}
            <div className="space-y-10 lg:col-span-2 lg:space-y-14">
              {/* What members get */}
              {perks.length > 0 && (
                <section>
                  {props.perks_title && (
                    <h2 className="font-sora text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {props.perks_title}
                    </h2>
                  )}
                  {props.perks_subtitle && (
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {props.perks_subtitle}
                    </p>
                  )}
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {perks.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-white/10 p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                        style={{ backgroundColor: theme.card }}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: accent }}
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-sora text-sm font-semibold text-white">
                            {p.text}
                          </p>
                          {p.description && (
                            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Who it's for */}
              {props.whofor_text && (
                <section
                  className="rounded-2xl border p-6 shadow-lg md:p-8"
                  style={{
                    borderColor: `${accent}33`,
                    backgroundColor: `${accent}14`,
                  }}
                >
                  {props.whofor_label && (
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: accent }}
                    >
                      {props.whofor_label}
                    </p>
                  )}
                  <p className="mt-2 font-sora text-lg font-medium leading-relaxed text-white sm:text-xl">
                    {props.whofor_text}
                  </p>
                </section>
              )}

              {/* Member social proof */}
              {(props.member_count_label || testimonials.length > 0) && (
                <section
                  className="overflow-hidden rounded-2xl border border-white/10 px-5 py-8 shadow-lg md:px-8 md:py-10"
                  style={{ backgroundColor: theme.card }}
                >
                  {props.member_count_label && (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                        style={{ backgroundColor: `${accent}26` }}
                      >
                        <Users className="h-4 w-4" style={{ color: accent }} />
                        {props.member_count_label}
                      </span>
                      <Stars rating={5} className="text-amber-400" />
                    </div>
                  )}

                  {props.proof_title && (
                    <h2 className="mt-6 text-center font-sora text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      {props.proof_title}
                    </h2>
                  )}

                  {testimonials.length > 0 && (
                    <div className="-mx-2 mt-6 flex gap-4 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {testimonials.map((t, i) => (
                        <figure
                          key={i}
                          className="min-w-[260px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur md:min-w-0"
                        >
                          <Star
                            className="mb-2 h-4 w-4 text-amber-400"
                            fill="currentColor"
                          />
                          <blockquote className="text-sm leading-relaxed text-white/90">
                            &ldquo;{t.quote}&rdquo;
                          </blockquote>
                          <figcaption className="mt-4 flex items-center gap-3">
                            <span
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
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
                  )}
                </section>
              )}
            </div>

            {/* ── RIGHT (sticky checkout) ────────────────────────────── */}
            <aside
              id="join"
              className="scroll-mt-8 lg:col-span-1 lg:sticky lg:top-8 lg:self-start"
            >
              <div
                className="rounded-2xl border p-6 shadow-2xl"
                style={{
                  backgroundColor: theme.card,
                  borderColor: `${accent}33`,
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white"
                  style={{ backgroundColor: `${accent}26` }}
                >
                  <Sparkles className="h-3 w-3" style={{ color: accent }} />
                  {props.hero_badge ?? "Members only"}
                </span>

                {props.checkout_title && (
                  <h3 className="mt-3 font-sora text-xl font-bold tracking-tight text-white">
                    {props.checkout_title}
                  </h3>
                )}
                <p className="mt-1 truncate text-sm text-zinc-400">
                  {productName}
                </p>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-sora text-4xl font-bold text-white">
                    ₹{Number(productPrice).toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {props.checkout_billing_note ??
                      (productCurrency === "INR" ? "INR" : productCurrency)}
                  </span>
                </div>

                {features.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    {props.checkout_features_title && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {props.checkout_features_title}
                      </p>
                    )}
                    <ul className="mt-2 space-y-1.5">
                      {features.slice(0, 6).map((it, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-zinc-300"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          <span>{it.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Checkout form */}
                <div className="mt-5">
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
                  <p className="mt-4 text-center text-xs text-zinc-400">
                    {props.checkout_guarantee}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <StickyCheckoutBar
        targetId="join"
        priceLabel={`₹${Number(productPrice).toLocaleString("en-IN")}`}
        cta={heroCta}
        buttonClassName="text-white"
        buttonStyle={{ backgroundColor: accent }}
        barClassName="border-t border-white/10"
        barStyle={{ backgroundColor: theme.card }}
      />
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
