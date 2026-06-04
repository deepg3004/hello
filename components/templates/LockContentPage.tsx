// Public sales page for a "Lock Content" page. Shows ONLY the teaser (what the
// buyer will unlock) + checkout — the actual locked body/links live in
// page_config but are NEVER rendered here, so they can't leak in the HTML. The
// real content is served server-side by /unlock/[pageId] after payment.

import { Lock, Check } from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";

interface UnlockItem {
  title?: string;
  description?: string;
}

interface LockContentPageProps {
  pageId?: string;
  slug?: string;
  isPreview?: boolean;
  product?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    currency: string;
    requires_shipping?: boolean | null;
  } | null;
  bumpRuntime?: import("@/components/templates/shared/types").BumpRuntime;
  accent?: string;
  hero_eyebrow?: string;
  hero_headline?: string;
  hero_subheadline?: string;
  hero_image?: string;
  unlock_title?: string;
  unlock_items?: UnlockItem[];
  checkout_title?: string;
  checkout_guarantee?: string;
}

export function LockContentPage(props: LockContentPageProps) {
  const accent = props.accent || "#7C3AED";
  const items = Array.isArray(props.unlock_items) ? props.unlock_items : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-12 md:py-16 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Hero */}
        <header className="text-center">
          {props.hero_eyebrow && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
              style={{ background: accent }}
            >
              <Lock className="h-3 w-3" />
              {props.hero_eyebrow}
            </span>
          )}
          <h1 className="mt-4 font-sora text-3xl font-bold tracking-tight sm:text-4xl">
            {props.hero_headline || "Unlock the full content"}
          </h1>
          {props.hero_subheadline && (
            <p className="mx-auto mt-3 max-w-xl text-zinc-600">
              {props.hero_subheadline}
            </p>
          )}
        </header>

        {props.hero_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.hero_image}
            alt={props.hero_headline ?? "Cover"}
            className="mx-auto w-full max-w-lg rounded-xl border border-zinc-200 object-cover shadow-sm"
          />
        )}

        {/* What you'll unlock (teaser only — no real content) */}
        {items.length > 0 && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="font-sora text-lg font-semibold">
              {props.unlock_title || "What you'll get"}
            </h2>
            <ul className="mt-4 space-y-3">
              {items.map((it, i) => (
                <li key={i} className="flex gap-3">
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0"
                    style={{ color: accent }}
                  />
                  <div>
                    {it.title && (
                      <p className="font-medium leading-tight">{it.title}</p>
                    )}
                    {it.description && (
                      <p className="text-sm text-zinc-600">{it.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Checkout */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <Lock className="h-4 w-4" />
            {props.checkout_title || "Pay once to unlock instantly"}
          </div>
          <div className="mt-4">
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
                  : "Set a price on this page to enable checkout."}
              </p>
            )}
          </div>
          {props.checkout_guarantee && (
            <p className="mt-3 text-center text-xs text-zinc-500">
              {props.checkout_guarantee}
            </p>
          )}
        </section>

        <p className="text-center text-xs text-zinc-400">
          <Lock className="mr-1 inline h-3 w-3" />
          Content is revealed on a private page the moment your payment succeeds.
        </p>
      </div>
    </main>
  );
}
