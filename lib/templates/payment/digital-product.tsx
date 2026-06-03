// Digital product — definition + adapter.

import { PaymentDigitalProductPage } from "@/components/templates/PaymentDigitalProductPage";
import { designSection } from "@/lib/templates/design";
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
        { key: "mockup_url", label: "Mockup / product image URL", type: "image", defaultValue: "" },
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
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Get instant access" },
      ],
    },
    {
      id: "features",
      label: "Features",
      type: "benefits",
      fields: [
        { key: "features_title", label: "Section title", type: "text", defaultValue: "What's inside" },
        {
          key: "features_items",
          label: "Features",
          type: "list",
          itemLabel: "feature",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
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
        { key: "price_card_title", label: "Card title", type: "text", defaultValue: "Buy once. Own it forever." },
        { key: "price_card_note", label: "Card note", type: "text", defaultValue: "Instant download after payment." },
      ],
    },
    designSection("emerald"),
  ],
};

const Render: TemplateRender = ({ values, pageId, product, isPreview, bumpRuntime }) => (
  <PaymentDigitalProductPage
    pageId={pageId}
    product={product}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    mockup_url={readField(values, "mockup_url", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_cta={readField(values, "hero_cta", "")}
    features_title={readField(values, "features_title", "")}
    features_items={readField(values, "features_items", [])}
    price_card_title={readField(values, "price_card_title", "")}
    price_card_note={readField(values, "price_card_note", "")}
    theme_key={readField(values, "theme", "emerald")}
    bg_animation={readField(values, "bg_animation", "none")}
  />
);

export const digitalProductTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
