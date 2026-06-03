// "Pay what you like" split checkout — light/Dawn theme, two-column layout.
// Inspired by SuperProfile-style course payment pages (white + golden accent,
// buyer-chosen amount). The pay-what-you-like amount is honoured server-side
// only because `pwyl_enabled` is written into page_config (see
// app/api/checkout/create-order/route.ts) and is always clamped to ≥ price.

import { PayWhatYouLikePage } from "@/components/templates/PayWhatYouLikePage";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type {
  Template,
  TemplateDefinition,
  TemplateRender,
} from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "pwyl",
  name: "Pay What You Like (Split)",
  description:
    "Minimal white + golden two-column checkout with a name-your-price selector. Built for courses & digital products in the Indian market.",
  category: "payment",
  dbType: "payment",
  thumbnail: "",
  theme: { name: "Dawn (Golden)", primary: "#F5C000", background: "#ffffff" },
  sections: [
    {
      id: "brand",
      label: "Brand & title",
      type: "hero",
      fields: [
        { key: "brand_logo", label: "Brand logo (circular)", type: "image", defaultValue: "" },
        { key: "brand_name", label: "Brand name", type: "text", defaultValue: "RD Algo" },
        {
          key: "page_title",
          label: "Page title",
          type: "text",
          defaultValue: "RD Algo Online Payment",
        },
      ],
    },
    {
      id: "cover",
      label: "Cover image",
      type: "media",
      fields: [
        { key: "cover_image", label: "Cover image", type: "image", defaultValue: "" },
        {
          key: "cover_overlay",
          label: "Overlay text",
          type: "text",
          defaultValue: "TRADING",
          hint: "Bold word shown over the cover image. Leave blank for none.",
        },
      ],
    },
    {
      id: "content",
      label: "Description & contact",
      type: "benefits",
      fields: [
        {
          key: "description",
          label: "Description",
          type: "textarea",
          defaultValue:
            "Join the RD Algo trading course and master systematic, rule-based intraday & swing strategies. Lifetime access to recorded sessions, indicator setups, and our private community. Pay securely below to enrol.",
        },
        {
          key: "contact_email",
          label: "Contact email",
          type: "text",
          defaultValue: "support@rdalgo.in",
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout & pricing",
      type: "checkout",
      fields: [
        {
          key: "pwyl_enabled",
          label: "Enable “Pay what you like”",
          type: "toggle",
          defaultValue: true,
          hint: "Let buyers choose the amount (never below the product price).",
        },
        {
          key: "card_title",
          label: "Checkout card title",
          type: "text",
          defaultValue: "Complete your payment",
        },
        {
          key: "accent_color",
          label: "Accent colour",
          type: "color",
          defaultValue: "#F5C000",
        },
        {
          key: "pwyl_min",
          label: "Minimum amount (₹)",
          type: "number",
          defaultValue: 5000,
          hint: "Must be ≥ the attached product's price.",
        },
        {
          key: "pwyl_presets",
          label: "Price options",
          type: "list",
          itemLabel: "price option",
          minItems: 1,
          maxItems: 6,
          itemFields: [
            { key: "amount", label: "Amount (₹)", type: "number", defaultValue: 5000 },
            { key: "label", label: "Small label (optional)", type: "text", defaultValue: "" },
            { key: "popular", label: "Mark as “Popular”", type: "toggle", defaultValue: false },
          ],
          defaultValue: [
            { amount: 5000, label: "", popular: false },
            { amount: 8749.5, label: "", popular: false },
            { amount: 12499, label: "", popular: true },
            { amount: 21248.5, label: "", popular: false },
          ],
        },
        {
          key: "terms",
          label: "Terms & Conditions",
          type: "textarea",
          defaultValue:
            "All payments are final. Course access is granted within 24 hours of payment. By paying you agree not to share or redistribute course material. Trading involves risk — past performance is not indicative of future results.",
        },
      ],
    },
    {
      id: "extras",
      label: "Gallery, reviews & FAQ",
      type: "testimonials",
      fields: [
        {
          key: "gallery",
          label: "Gallery images",
          type: "list",
          itemLabel: "image",
          minItems: 0,
          maxItems: 9,
          itemFields: [{ key: "url", label: "Image", type: "image", defaultValue: "" }],
          defaultValue: [],
        },
        {
          key: "testimonials",
          label: "Testimonials",
          type: "list",
          itemLabel: "testimonial",
          minItems: 0,
          maxItems: 12,
          itemFields: [
            { key: "quote", label: "Quote", type: "textarea", defaultValue: "" },
            { key: "author", label: "Name", type: "text", defaultValue: "" },
            { key: "role", label: "Role", type: "text", defaultValue: "" },
          ],
          defaultValue: [],
        },
        {
          key: "faqs",
          label: "FAQ",
          type: "list",
          itemLabel: "question",
          minItems: 0,
          maxItems: 12,
          itemFields: [
            { key: "question", label: "Question", type: "text", defaultValue: "" },
            { key: "answer", label: "Answer", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [],
        },
      ],
    },
  ],
};

const Render: TemplateRender = ({
  values,
  pageId,
  slug,
  product,
  products,
  isPreview,
  bumpRuntime,
}) => (
  <PayWhatYouLikePage
    pageId={pageId}
    slug={slug}
    product={product}
    products={products}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    brand_logo={readField(values, "brand_logo", "")}
    brand_name={readField(values, "brand_name", "")}
    page_title={readField(values, "page_title", "")}
    cover_image={readField(values, "cover_image", "")}
    cover_overlay={readField(values, "cover_overlay", "")}
    description={readField(values, "description", "")}
    contact_email={readField(values, "contact_email", "")}
    accent_color={readField(values, "accent_color", "#F5C000")}
    card_title={readField(values, "card_title", "")}
    pwyl_min={readField(values, "pwyl_min", 0)}
    pwyl_presets={readField(values, "pwyl_presets", [])}
    terms={readField(values, "terms", "")}
    gallery={readField(values, "gallery", [])}
    testimonials={readField(values, "testimonials", [])}
    faqs={readField(values, "faqs", [])}
  />
);

export const pwylTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
