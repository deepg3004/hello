"use client";

import { useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  Images,
  Mail,
  Quote,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import { cn } from "@/lib/utils";
import type { BaseTemplateProps } from "./shared/types";

interface PresetItem {
  amount: number | string;
  label?: string;
  popular?: boolean;
}
interface GalleryItem {
  url: string;
}
interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}
interface Faq {
  question: string;
  answer: string;
}

export interface PayWhatYouLikePageProps extends BaseTemplateProps {
  brand_logo?: string;
  brand_name?: string;
  page_title?: string;
  cover_image?: string;
  cover_overlay?: string;
  description?: string;
  contact_email?: string;
  accent_color?: string;
  /** Small heading on the checkout card. */
  card_title?: string;
  pwyl_presets?: PresetItem[];
  pwyl_min?: number;
  terms?: string;
  gallery?: GalleryItem[];
  testimonials?: Testimonial[];
  faqs?: Faq[];
}

const DEFAULT_ACCENT = "#F5C000";
const FALLBACK_PRICE = 5000;

// Subtle hexagonal geometric texture (Hero-Patterns style) tinted white — sits
// behind the golden checkout column. Encoded as a data-URI so it ships inline.
const HEX_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg width='28' height='49' viewBox='0 0 28 49' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.22' stroke-width='1.2'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/svg%3E\")";

export function PayWhatYouLikePage(props: PayWhatYouLikePageProps) {
  const accent = props.accent_color?.trim() || DEFAULT_ACCENT;
  const title =
    props.page_title?.trim() ||
    props.product?.name ||
    "RD Algo Online Payment";
  const productPrice = props.product?.price ?? FALLBACK_PRICE;
  const pwylMin =
    props.pwyl_min && props.pwyl_min > 0 ? props.pwyl_min : Number(productPrice);

  const presets = (props.pwyl_presets ?? [])
    .map((p) => ({
      amount: Number(p.amount),
      label: p.label,
      popular: !!p.popular,
    }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0);

  const gallery = (props.gallery ?? []).filter((g) => g.url?.trim());
  const testimonials = (props.testimonials ?? []).filter((t) => t.quote?.trim());
  const faqs = (props.faqs ?? []).filter((f) => f.question?.trim());
  const brandName = props.brand_name?.trim() || "InvoxAI";

  // Headline amount for the mobile sticky bar (popular preset → first → min).
  const stickyAmount =
    presets.find((p) => p.popular)?.amount ?? presets[0]?.amount ?? pwylMin;
  const hasLiveCheckout = !!(props.pageId && props.product && !props.isPreview);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* ════════════════════ LEFT — product details ════════════════════ */}
        <div className="px-5 py-8 sm:px-8 md:py-12 lg:pr-12">
          {/* Brand row */}
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-zinc-50 text-base font-bold"
              style={{ borderColor: accent, color: accent }}
            >
              {props.brand_logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.brand_logo}
                  alt={brandName}
                  className="h-full w-full object-cover"
                />
              ) : (
                brandName[0]?.toUpperCase() ?? "R"
              )}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {brandName}
            </span>
          </div>

          {/* Title */}
          <h1 className="mt-5 font-sora text-[22px] font-bold leading-snug tracking-tight text-zinc-900 sm:text-2xl">
            {title}
          </h1>

          {/* Cover image with overlay text */}
          <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
            {props.cover_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={props.cover_image}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <CandlestickBackdrop accent={accent} />
            )}
            {props.cover_overlay?.trim() && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <span
                  className="font-sora text-3xl font-extrabold uppercase tracking-[0.2em] text-white sm:text-4xl"
                  style={{ textShadow: "0 2px 18px rgba(0,0,0,0.5)" }}
                >
                  {props.cover_overlay}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {props.description?.trim() && (
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-zinc-600">
                {props.description}
              </p>
            </div>
          )}

          {/* Seller contact */}
          {props.contact_email?.trim() && (
            <a
              href={`mailto:${props.contact_email}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-700 transition hover:border-zinc-300"
            >
              <Mail className="h-4 w-4" style={{ color: accent }} />
              {props.contact_email}
            </a>
          )}

          {/* Collapsible extras */}
          <div className="mt-6 space-y-3">
            {props.terms?.trim() && (
              <Accordion
                icon={<ScrollText className="h-4 w-4" />}
                title="Seller's Terms & Conditions"
                accent={accent}
              >
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-600">
                  {props.terms}
                </p>
              </Accordion>
            )}

            {gallery.length > 0 && (
              <Accordion
                icon={<Images className="h-4 w-4" />}
                title={`Gallery (${gallery.length})`}
                accent={accent}
              >
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((g, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={i}
                      src={g.url}
                      alt={`Gallery ${i + 1}`}
                      className="aspect-square w-full rounded-lg border border-zinc-200 object-cover"
                    />
                  ))}
                </div>
              </Accordion>
            )}

            {testimonials.length > 0 && (
              <Accordion
                icon={<Quote className="h-4 w-4" />}
                title={`Testimonials (${testimonials.length})`}
                accent={accent}
              >
                <div className="space-y-3">
                  {testimonials.map((t, i) => (
                    <figure
                      key={i}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5"
                    >
                      <blockquote className="text-[13px] leading-relaxed text-zinc-700">
                        &ldquo;{t.quote}&rdquo;
                      </blockquote>
                      <figcaption className="mt-2 text-xs font-semibold text-zinc-900">
                        {t.author}
                        {t.role && (
                          <span className="font-normal text-zinc-500">
                            {" "}
                            · {t.role}
                          </span>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Accordion>
            )}

            {faqs.length > 0 && (
              <Accordion
                icon={<HelpCircle className="h-4 w-4" />}
                title={`FAQ (${faqs.length})`}
                accent={accent}
              >
                <div className="space-y-3">
                  {faqs.map((f, i) => (
                    <div key={i}>
                      <p className="text-[13px] font-semibold text-zinc-900">
                        {f.question}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                        {f.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </Accordion>
            )}
          </div>
        </div>

        {/* ════════════════════ RIGHT — golden checkout ═══════════════════ */}
        <div
          id="pay"
          className="relative scroll-mt-4 px-5 py-8 pb-24 sm:px-8 md:py-12 md:pb-12 lg:pl-12"
          style={{ backgroundColor: accent }}
        >
          {/* Hexagonal pattern texture */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: HEX_PATTERN }}
          />

          <div className="relative lg:sticky lg:top-8">
            <div className="rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${accent}26`, color: "#8a6d00" }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="font-sora text-base font-bold text-zinc-900">
                  {props.card_title?.trim() || "Complete your payment"}
                </h3>
              </div>

              {props.product ? (
                // Render the real checkout — even in the editor preview (in a
                // network-safe `preview` mode) so design edits are visible.
                <CheckoutForm
                  pageId={props.pageId ?? "preview"}
                  productId={props.product.id}
                  requiresShipping={!!props.product.requires_shipping}
                  productName={props.product.name}
                  productDescription={props.product.description}
                  productImage={props.product.image_url}
                  price={Number(props.product.price)}
                  currency={props.product.currency}
                  primaryColor={accent}
                  payLabel="Make Payment"
                  preview={props.isPreview}
                  payWhatYouLike={
                    presets.length > 0 || pwylMin > 0
                      ? { presets, min: pwylMin }
                      : undefined
                  }
                  orderBump={
                    props.bumpRuntime
                      ? { ...props.bumpRuntime, ready: true }
                      : undefined
                  }
                />
              ) : (
                <PreviewPanel
                  accent={accent}
                  presets={presets}
                  isPreview={props.isPreview}
                />
              )}
            </div>

            {/* SuperProfile-style branding badge */}
            <div className="mt-4 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#8a6d00" }} />
                Secured by {brandName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only sticky CTA — scrolls to the checkout card. */}
      {hasLiveCheckout && (
        <StickyCheckoutBar
          targetId="pay"
          cta="Make Payment"
          priceLabel={`₹${stickyAmount.toLocaleString("en-IN")}`}
          buttonClassName="text-zinc-900"
          buttonStyle={{ backgroundColor: accent }}
          barClassName="border-t border-zinc-200 bg-white"
        />
      )}
    </div>
  );
}

// ─────────────────────────── sub-components ───────────────────────────────

function Accordion({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[13px] font-semibold text-zinc-800"
      >
        <span className="flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** CSS candlestick-chart backdrop used when no cover image is set. */
function CandlestickBackdrop({ accent }: { accent: string }) {
  const bars = [
    { h: 40, up: true },
    { h: 62, up: false },
    { h: 30, up: true },
    { h: 74, up: true },
    { h: 50, up: false },
    { h: 84, up: true },
    { h: 46, up: false },
    { h: 68, up: true },
  ];
  return (
    <div className="flex h-full w-full items-end justify-center gap-2 bg-gradient-to-br from-zinc-900 to-zinc-800 px-6 pb-6">
      {bars.map((b, i) => (
        <span
          key={i}
          className="w-3 rounded-sm"
          style={{
            height: `${b.h}%`,
            backgroundColor: b.up ? accent : "#3f3f46",
          }}
        />
      ))}
    </div>
  );
}

/** Static preview of the checkout panel (builder iframe + no-product state). */
function PreviewPanel({
  accent,
  presets,
  isPreview,
}: {
  accent: string;
  presets: Array<{ amount: number; label?: string; popular?: boolean }>;
  isPreview?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Email
        </p>
        <div className="h-10 rounded-md border border-zinc-200 bg-zinc-50" />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Pay what you like
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(presets.length
            ? presets
            : [
                { amount: 5000 },
                { amount: 8749.5 },
                { amount: 12499, popular: true },
                { amount: 21248.5 },
              ]
          ).map((p, i) => (
            <span
              key={i}
              className="relative rounded-full border px-3 py-2.5 text-center text-sm font-semibold text-zinc-700"
              style={
                p.popular
                  ? { borderColor: accent, background: `${accent}1f` }
                  : { borderColor: "#e4e4e7" }
              }
            >
              ₹{p.amount.toLocaleString("en-IN")}
              {p.popular && (
                <span
                  className="absolute -top-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                  style={{ background: accent }}
                >
                  Popular
                </span>
              )}
            </span>
          ))}
          <span className="rounded-full border border-zinc-200 px-3 py-2.5 text-center text-sm font-semibold text-zinc-700">
            Other
          </span>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Phone
        </p>
        <div className="flex h-10 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-400">
          +91
        </div>
      </div>
      <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-sm">
        <div className="flex justify-between text-zinc-500">
          <span>Sub Total</span>
          <span>₹{(presets[0]?.amount ?? 5000).toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-semibold text-zinc-900">
          <span>Total</span>
          <span>₹{(presets[0]?.amount ?? 5000).toLocaleString("en-IN")}</span>
        </div>
      </div>
      <div
        className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white"
        style={{ background: accent }}
      >
        Make Payment →
      </div>
      <p className="text-center text-xs text-zinc-400">
        {isPreview
          ? "Checkout activates on the live page."
          : "Attach a product to enable checkout."}
      </p>
    </div>
  );
}
