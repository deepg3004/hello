// All-in-one bundle / mega-deal sales page — definition + adapter to the component.

import { BundlePage } from "@/components/templates/BundlePage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "bundle",
  name: "Bundle Deal Page",
  description: "Value-stacking mega-deal page that bundles everything into one irresistible offer.",
  category: "payment",
  dbType: "payment",
  thumbnail: "",
  theme: { name: "Black & Gold", primary: "#d4af37", background: "#0a0a0a" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow text", type: "text", defaultValue: "Limited bundle" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Everything you need, bundled into one unbeatable deal",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Stop buying piece by piece. Get every course, template, and resource together — for a fraction of what they cost separately.",
        },
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Get the bundle" },
      ],
    },
    {
      id: "stack",
      label: "Value stack",
      type: "benefits",
      fields: [
        { key: "stack_title", label: "Section title", type: "text", defaultValue: "Everything you get" },
        {
          key: "stack_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Here's the full value stacked up — every piece included in the bundle.",
        },
        {
          key: "stack_items",
          label: "Value stack items",
          type: "list",
          itemLabel: "item",
          minItems: 1,
          maxItems: 14,
          itemFields: [
            { key: "name", label: "Item name", type: "text", defaultValue: "" },
            { key: "worth", label: "Individual worth (crossed out)", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { name: "The Core Masterclass (8 hours)", worth: "₹4,999" },
            { name: "Done-for-you template library", worth: "₹2,999" },
            { name: "Private community access", worth: "₹1,999" },
            { name: "Weekly live Q&A recordings", worth: "₹2,499" },
            { name: "Swipe-file & prompt vault", worth: "₹1,499" },
            { name: "Bonus: Launch checklist & toolkit", worth: "₹999" },
          ],
        },
        {
          key: "stack_total_label",
          label: "Total-value label",
          type: "text",
          defaultValue: "Total real value",
        },
        {
          key: "stack_total_value",
          label: "Total value (crossed out)",
          type: "text",
          defaultValue: "₹14,994",
          hint: 'The combined worth, shown struck through — e.g. "₹14,994".',
        },
        {
          key: "stack_total_yours",
          label: "Yours-for line",
          type: "text",
          defaultValue: "Yours for ₹1,999",
          hint: 'The headline price reveal — e.g. "Yours for ₹1,999".',
        },
      ],
    },
    {
      id: "inside",
      label: "What's inside",
      type: "benefits",
      fields: [
        { key: "inside_title", label: "Section title", type: "text", defaultValue: "What's inside the bundle" },
        {
          key: "inside_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "A closer look at every module and asset you'll unlock instantly.",
        },
        {
          key: "inside_items",
          label: "Bundle items / modules",
          type: "list",
          itemLabel: "item",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "title", label: "Item title", type: "text", defaultValue: "" },
            { key: "description", label: "Short description", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { title: "Core Masterclass", description: "8 hours of step-by-step video lessons, start to finish." },
            { title: "Template Library", description: "Plug-and-play templates you can use the same day." },
            { title: "Community Access", description: "A private space to ask, share, and stay accountable." },
            { title: "Live Q&A Vault", description: "Every past session recorded and searchable." },
            { title: "Swipe & Prompt Vault", description: "Proven copy and prompts ready to adapt." },
            { title: "Launch Toolkit", description: "Checklists and tools to ship without guesswork." },
          ],
        },
      ],
    },
    {
      id: "proof",
      label: "Testimonials",
      type: "testimonials",
      fields: [
        { key: "proof_title", label: "Section title", type: "text", defaultValue: "Buyers love the bundle" },
        {
          key: "testimonials_items",
          label: "Testimonials",
          type: "list",
          itemLabel: "testimonial",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "quote", label: "Quote", type: "textarea", defaultValue: "" },
            { key: "author", label: "Author", type: "text", defaultValue: "" },
            { key: "role", label: "Role", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            {
              quote: "Buying the bundle saved me thousands versus grabbing each piece on its own. No-brainer.",
              author: "Aarav S.",
              role: "Founder",
            },
            {
              quote: "Everything I needed in one place — I stopped hunting and just started doing.",
              author: "Priya M.",
              role: "Creator",
            },
            {
              quote: "The value stack is real. I've already made back the price ten times over.",
              author: "Rohan K.",
              role: "Freelancer",
            },
          ],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      fields: [
        { key: "checkout_title", label: "Section title", type: "text", defaultValue: "Grab the bundle" },
        {
          key: "checkout_billing_note",
          label: "Billing note (next to price)",
          type: "text",
          defaultValue: "one-time",
          hint: 'e.g. "one-time", "/ year", or "lifetime".',
        },
        { key: "checkout_features_title", label: "Features list title", type: "text", defaultValue: "Your bundle includes" },
        {
          key: "checkout_features",
          label: "Checkout features",
          type: "list",
          itemLabel: "feature",
          minItems: 0,
          maxItems: 8,
          itemFields: [{ key: "title", label: "Feature", type: "text", defaultValue: "" }],
          defaultValue: [
            { title: "Instant access to everything" },
            { title: "All courses, templates & bonuses" },
            { title: "Lifetime updates included" },
            { title: "Private community access" },
          ],
        },
        {
          key: "checkout_guarantee",
          label: "Guarantee line",
          type: "text",
          defaultValue: "7-day money-back guarantee. Love the bundle or get a full refund.",
        },
      ],
    },
    designSection("gold"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <BundlePage
    pageId={pageId}
    slug={slug}
    product={product}
    products={products}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    hero_eyebrow={readField(values, "hero_eyebrow", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_cta={readField(values, "hero_cta", "")}
    stack_title={readField(values, "stack_title", "")}
    stack_subtitle={readField(values, "stack_subtitle", "")}
    stack_items={readField(values, "stack_items", [])}
    stack_total_label={readField(values, "stack_total_label", "")}
    stack_total_value={readField(values, "stack_total_value", "")}
    stack_total_yours={readField(values, "stack_total_yours", "")}
    inside_title={readField(values, "inside_title", "")}
    inside_subtitle={readField(values, "inside_subtitle", "")}
    inside_items={readField(values, "inside_items", [])}
    proof_title={readField(values, "proof_title", "")}
    testimonials_items={readField(values, "testimonials_items", [])}
    checkout_title={readField(values, "checkout_title", "")}
    checkout_billing_note={readField(values, "checkout_billing_note", "")}
    checkout_features_title={readField(values, "checkout_features_title", "")}
    checkout_features={readField(values, "checkout_features", [])}
    checkout_guarantee={readField(values, "checkout_guarantee", "")}
    theme_key={readField(values, "theme", "gold")}
    bg_animation={readField(values, "bg_animation", "none")}
  />
);

export const bundleTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
