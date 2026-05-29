// Minimal digital-product page — clean white + teal accent.

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "digital-product",
  name: "Digital Product",
  description: "Minimal page for e-books, templates, tools and other digital downloads.",
  category: "payment",
  dbType: "payment",
  thumbnail: "/templates/digital-product.svg",
  theme: { name: "White + Teal", primary: "#0d9488", background: "#ffffff" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "mockup_url",
          label: "Mockup / product image URL",
          type: "image",
          defaultValue: "",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The 50-page Notion playbook every founder needs",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Templates, prompts, and SOPs to run your business in Notion — without the bloat.",
        },
        {
          key: "hero_cta",
          label: "CTA button label",
          type: "text",
          defaultValue: "Get instant access",
        },
      ],
    },
    {
      id: "features",
      label: "Features",
      type: "benefits",
      fields: [
        {
          key: "features_title",
          label: "Section title",
          type: "text",
          defaultValue: "What's inside",
        },
        {
          key: "features_items",
          label: "Features",
          type: "list",
          itemLabel: "feature",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "12 Notion templates ready to duplicate" },
            { text: "30+ pre-written SOPs you can ship today" },
            { text: "Lifetime updates as the playbook evolves" },
          ],
        },
      ],
    },
    {
      id: "price_card",
      label: "Price card",
      type: "checkout",
      fields: [
        {
          key: "price_card_title",
          label: "Card title",
          type: "text",
          defaultValue: "Buy once. Own it forever.",
        },
        {
          key: "price_card_note",
          label: "Card note",
          type: "text",
          defaultValue: "Instant download after payment.",
        },
      ],
    },
  ],
};

interface FeatureItem { text: string }

const Render: TemplateRender = ({ values, pageId, product, isPreview }) => {
  const mockup = readField(values, "mockup_url", "");
  const headline = readField(values, "hero_headline", "");
  const sub = readField(values, "hero_subheadline", "");
  const cta = readField(values, "hero_cta", "Get instant access");
  const ftitle = readField(values, "features_title", "What's inside");
  const features = readField<FeatureItem[]>(values, "features_items", []);
  const pcTitle = readField(values, "price_card_title", "");
  const pcNote = readField(values, "price_card_note", "");

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <section className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <div className="order-2 md:order-1">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {headline}
          </h1>
          {sub && (
            <p className="mt-5 text-lg leading-relaxed text-zinc-600">{sub}</p>
          )}
          <a
            href="#buy"
            className="mt-8 inline-block rounded-md bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-teal-700"
          >
            {cta}
          </a>
        </div>
        <div className="order-1 md:order-2">
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {mockup ? (
              <img src={mockup} alt={headline} className="h-full w-full object-cover" />
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
            <h2 className="text-2xl font-semibold tracking-tight">{ftitle}</h2>
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

      <section id="buy" className="border-t border-zinc-200 bg-zinc-50 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{pcTitle}</h2>
          {pcNote && (
            <p className="mt-2 text-center text-sm text-zinc-500">{pcNote}</p>
          )}
          <div className="mt-8">
            {pageId && product && !isPreview ? (
              <CheckoutForm
                pageId={pageId}
                productId={product.id}
                productName={product.name}
                productDescription={product.description}
                productImage={product.image_url}
                price={Number(product.price)}
                currency={product.currency}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                {isPreview
                  ? "Checkout form renders on the live page."
                  : "Attach a product to this page to enable checkout."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export const digitalProductTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
