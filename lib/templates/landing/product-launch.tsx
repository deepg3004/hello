// Product launch — definition + adapter.

import { ProductLaunchPage } from "@/components/templates/ProductLaunchPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "product-launch",
  name: "Product Launch",
  description:
    "Bold launch page — punchy hero, feature grid, how-it-works, social proof, and an email-capture list.",
  category: "landing",
  dbType: "landing",
  thumbnail: "",
  theme: { name: "Purple", primary: "#0088cc", background: "#1a0733" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow", type: "text", defaultValue: "Now in early access" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The launch your audience has been waiting for",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Join the early-access list and be the first to get it the moment we go live — plus a launch-day discount.",
        },
        { key: "hero_cta", label: "Hero button label", type: "text", defaultValue: "Get early access" },
      ],
    },
    {
      id: "features",
      label: "Features / benefits",
      type: "benefits",
      fields: [
        { key: "features_title", label: "Section title", type: "text", defaultValue: "Everything you need to launch" },
        {
          key: "features_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Built to help you ship faster, look premium, and convert from day one.",
        },
        {
          key: "features",
          label: "Feature cards",
          type: "list",
          itemLabel: "feature",
          minItems: 1,
          maxItems: 6,
          itemFields: [
            { key: "icon", label: "Icon (emoji, optional)", type: "text", defaultValue: "" },
            { key: "title", label: "Title", type: "text", defaultValue: "" },
            { key: "description", label: "Description", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            {
              icon: "⚡",
              title: "Lightning fast",
              description: "Go from idea to live page in minutes — no code, no friction.",
            },
            {
              icon: "🎯",
              title: "Built to convert",
              description: "Premium, mobile-first design tuned for sign-ups out of the box.",
            },
            {
              icon: "🔒",
              title: "Yours forever",
              description: "Own your list and your data — export anytime, no lock-in.",
            },
          ],
        },
      ],
    },
    {
      id: "steps",
      label: "How it works",
      type: "benefits",
      fields: [
        { key: "steps_title", label: "Section title", type: "text", defaultValue: "How it works" },
        {
          key: "steps",
          label: "Steps",
          type: "list",
          itemLabel: "step",
          minItems: 1,
          maxItems: 4,
          itemFields: [
            { key: "title", label: "Title", type: "text", defaultValue: "" },
            { key: "description", label: "Description", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            { title: "Join the list", description: "Drop your email and reserve your spot in seconds." },
            { title: "Get notified", description: "We'll ping you the moment it goes live — no spam." },
            { title: "Launch-day perks", description: "Unlock an early-bird discount reserved for the list." },
          ],
        },
      ],
    },
    {
      id: "proof",
      label: "Social proof / stats",
      type: "stats",
      fields: [
        { key: "proof_title", label: "Strip label", type: "text", defaultValue: "Trusted by creators worldwide" },
        {
          key: "stats",
          label: "Stats",
          type: "list",
          itemLabel: "stat",
          minItems: 1,
          maxItems: 4,
          itemFields: [
            { key: "value", label: "Value", type: "text", defaultValue: "" },
            { key: "label", label: "Label", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { value: "12,400+", label: "On the waitlist" },
            { value: "4.9★", label: "Average rating" },
            { value: "30+", label: "Countries" },
          ],
        },
      ],
    },
    {
      id: "capture",
      label: "Email capture",
      type: "form",
      category: "leads",
      fields: [
        { key: "capture_title", label: "Section title", type: "text", defaultValue: "Be first in line" },
        {
          key: "capture_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Add your email and we'll send you the link the second we launch.",
        },
        { key: "capture_cta", label: "Button label", type: "text", defaultValue: "Notify me at launch" },
        {
          key: "capture_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "We'll only email you about the launch.",
        },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "e.g. a thank-you page or a community invite link.",
        },
      ],
    },
    {
      id: "advanced",
      label: "Conversion boosters",
      type: "advanced",
      fields: [
        { key: "sticky_cta", label: "Mobile sticky button label", type: "text", defaultValue: "Get early access" },
        { key: "countdown_enabled", label: "Show launch countdown", type: "toggle", defaultValue: false },
        { key: "countdown_target", label: "Launch date/time (ISO)", type: "text", defaultValue: "" },
        { key: "countdown_label", label: "Countdown label", type: "text", defaultValue: "Launching in" },
      ],
    },
    designSection("purple"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <ProductLaunchPage
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
    features_title={readField(values, "features_title", "")}
    features_subtitle={readField(values, "features_subtitle", "")}
    features={readField(values, "features", [])}
    steps_title={readField(values, "steps_title", "")}
    steps={readField(values, "steps", [])}
    proof_title={readField(values, "proof_title", "")}
    stats={readField(values, "stats", [])}
    capture_title={readField(values, "capture_title", "")}
    capture_subtitle={readField(values, "capture_subtitle", "")}
    capture_cta={readField(values, "capture_cta", "")}
    capture_privacy={readField(values, "capture_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    sticky_cta={readField(values, "sticky_cta", "")}
    countdown_enabled={!!readField(values, "countdown_enabled", false)}
    countdown_target={readField(values, "countdown_target", "") || undefined}
    countdown_label={readField(values, "countdown_label", "")}
    theme_key={readField(values, "theme", "purple")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const productLaunchTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
