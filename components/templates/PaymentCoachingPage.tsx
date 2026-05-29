"use client";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { Countdown } from "./shared/Countdown";
import { SocialProofPopup } from "./shared/SocialProofPopup";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type { BaseTemplateProps, ThemeConfig } from "./shared/types";
import { DEFAULT_THEME } from "./shared/types";

interface Bullet { text: string }

export interface PaymentCoachingPageProps extends BaseTemplateProps {
  urgency_enabled?: boolean;
  urgency_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  wyg_title?: string;
  wyg_items?: Bullet[];
  metric1_value?: string;
  metric1_label?: string;
  metric2_value?: string;
  metric2_label?: string;
  metric3_value?: string;
  metric3_label?: string;
  who_title?: string;
  who_items?: Bullet[];
  checkout_title?: string;
  checkout_note?: string;
}

export function PaymentCoachingPage(props: PaymentCoachingPageProps) {
  const theme: Required<ThemeConfig> = {
    ...DEFAULT_THEME,
    bgFrom: "#18181b",
    bgTo: "#27272a",
    heroText: "#ffffff",
    primary: "#f97316",
    mode: "dark",
    ...props.theme,
  };

  const wyg = props.wyg_items ?? [];
  const who = props.who_items ?? [];
  const timer = props.timer;

  const price = props.product?.price ?? 0;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {props.urgency_enabled && props.urgency_text && (
        <div
          className="px-4 py-2 text-center text-sm font-medium"
          style={{ background: theme.primary, color: "#1a0a02" }}
        >
          {props.urgency_text}
        </div>
      )}

      <section
        className="px-4 pb-16 pt-14 text-center"
        style={{
          background: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
          color: theme.heroText,
        }}
      >
        <div className="mx-auto max-w-3xl">
          {timer?.enabled && timer.target && (
            <div className="mb-8 flex justify-center">
              <Countdown
                targetIso={timer.target}
                label={timer.label ?? "Cohort closes in"}
                boxClassName="bg-orange-500/15 text-orange-100"
              />
            </div>
          )}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {props.hero_headline}
          </h1>
          {props.hero_subheadline && (
            <p className="mt-5 text-lg leading-relaxed text-zinc-300">
              {props.hero_subheadline}
            </p>
          )}
          <a
            href="#book"
            className="mt-8 inline-block rounded-md px-6 py-3 text-sm font-semibold shadow"
            style={{ background: theme.primary, color: "#ffffff" }}
          >
            {props.hero_cta ?? "Book a strategy call"}
          </a>
        </div>
      </section>

      <section className="bg-zinc-800 py-12">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-6 text-center md:grid-cols-3">
          {[
            [props.metric1_value, props.metric1_label],
            [props.metric2_value, props.metric2_label],
            [props.metric3_value, props.metric3_label],
          ].map(([v, l], i) =>
            v ? (
              <div key={i}>
                <div
                  className="text-3xl font-semibold"
                  style={{ color: theme.primary }}
                >
                  {v}
                </div>
                <div className="text-sm text-zinc-400">{l}</div>
              </div>
            ) : null,
          )}
        </div>
      </section>

      {wyg.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {props.wyg_title}
            </h2>
            <ul className="mt-6 space-y-3">
              {wyg.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-2 inline-block h-1.5 w-3 shrink-0 rounded-sm"
                    style={{ background: theme.primary }}
                  />
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {who.length > 0 && (
        <section className="bg-zinc-800 py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {props.who_title}
            </h2>
            <ul className="mt-6 space-y-2">
              {who.map((b, i) => (
                <li
                  key={i}
                  className="rounded-md border border-white/5 bg-zinc-900 px-4 py-3 text-zinc-200"
                >
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="book" className="scroll-mt-16 pb-32 pt-16 md:pb-16">
        <div className="mx-auto max-w-5xl px-6">
          {props.checkout_title && (
            <h2 className="text-center text-2xl font-semibold tracking-tight">
              {props.checkout_title}
            </h2>
          )}
          {props.checkout_note && (
            <p className="mt-2 text-center text-sm text-zinc-400">
              {props.checkout_note}
            </p>
          )}
          <div className="mt-8 rounded-xl bg-white p-6 text-zinc-900 shadow-2xl">
            {props.pageId && props.product && !props.isPreview ? (
              <CheckoutForm
                pageId={props.pageId}
                productId={props.product.id}
                productName={props.product.name}
                productDescription={props.product.description}
                productImage={props.product.image_url}
                price={Number(props.product.price)}
                currency={props.product.currency}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                {props.isPreview
                  ? "Checkout form renders on the live page."
                  : "Attach a product to this page to enable checkout."}
              </p>
            )}
          </div>
        </div>
      </section>

      <StickyCheckoutBar
        targetId="book"
        priceLabel={price ? `₹${price.toLocaleString("en-IN")}` : "Book"}
        cta={props.hero_cta ?? "Book"}
        buttonClassName="bg-orange-500 text-white"
      />

      {props.pageId && (
        <SocialProofPopup
          pageId={props.pageId}
          disabled={props.isPreview || !props.socialProofEnabled}
        />
      )}
    </div>
  );
}
