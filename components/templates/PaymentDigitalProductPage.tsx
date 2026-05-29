"use client";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type { BaseTemplateProps } from "./shared/types";

interface Feature { text: string }

export interface PaymentDigitalProductPageProps extends BaseTemplateProps {
  mockup_url?: string;
  hero_headline: string;
  hero_subheadline?: string;
  hero_cta?: string;
  features_title?: string;
  features_items?: Feature[];
  price_card_title?: string;
  price_card_note?: string;
}

export function PaymentDigitalProductPage(props: PaymentDigitalProductPageProps) {
  const features = props.features_items ?? [];
  const price = props.product?.price ?? 0;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <section className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <div className="order-2 md:order-1">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {props.hero_headline}
          </h1>
          {props.hero_subheadline && (
            <p className="mt-5 text-lg leading-relaxed text-zinc-600">
              {props.hero_subheadline}
            </p>
          )}
          <a
            href="#buy"
            className="mt-8 inline-block rounded-md bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-teal-700"
          >
            {props.hero_cta ?? "Get instant access"}
          </a>
        </div>
        <div className="order-1 md:order-2">
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {props.mockup_url ? (
              <img
                src={props.mockup_url}
                alt={props.hero_headline}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Product mockup
              </div>
            )}
          </div>
        </div>
      </section>

      {features.length > 0 && (
        <section className="border-t border-zinc-200 py-16">
          <div className="mx-auto max-w-2xl px-6">
            {props.features_title && (
              <h2 className="text-2xl font-semibold tracking-tight">
                {props.features_title}
              </h2>
            )}
            <ul className="mt-6 space-y-3">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                    ✓
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="buy" className="scroll-mt-16 border-t border-zinc-200 bg-zinc-50 pb-32 pt-16 md:pb-16">
        <div className="mx-auto max-w-3xl px-6">
          {props.price_card_title && (
            <h2 className="text-center text-2xl font-semibold tracking-tight">
              {props.price_card_title}
            </h2>
          )}
          {props.price_card_note && (
            <p className="mt-2 text-center text-sm text-zinc-500">
              {props.price_card_note}
            </p>
          )}
          <div className="mt-8">
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
        targetId="buy"
        priceLabel={price ? `₹${price.toLocaleString("en-IN")}` : "Buy"}
        cta={props.hero_cta ?? "Buy"}
        buttonClassName="bg-teal-600 text-white"
      />
    </div>
  );
}
