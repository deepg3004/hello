// SaaS / software product landing — definition + adapter.

import { SaasLandingPage } from "@/components/templates/SaasLandingPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "saas",
  name: "SaaS / Software Product",
  description:
    "Modern software landing — hero with product mockup, trust strip, feature grid, checkmark benefits, a testimonial, and a get-early-access email capture.",
  category: "landing",
  dbType: "landing",
  thumbnail: "",
  theme: { name: "Midnight", primary: "#3b82f6", background: "#0A1628" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "hero_eyebrow",
          label: "Eyebrow",
          type: "text",
          defaultValue: "Now in early access",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The all-in-one platform your team actually loves",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Ship faster, collaborate in real time, and automate the busywork — one workspace for everything your team needs to move.",
        },
        {
          key: "hero_primary_cta",
          label: "Primary button label",
          type: "text",
          defaultValue: "Get early access",
        },
        {
          key: "hero_secondary_cta",
          label: "Secondary link label (watch demo)",
          type: "text",
          defaultValue: "Watch the demo",
        },
        {
          key: "hero_screenshot_url",
          label: "Product screenshot URL (optional)",
          type: "text",
          defaultValue: "",
          hint: "Shown inside the browser-mockup frame. Leave blank for a placeholder.",
        },
        {
          key: "hero_mockup_caption",
          label: "Mockup placeholder caption",
          type: "text",
          defaultValue: "Your product preview",
        },
      ],
    },
    {
      id: "trust",
      label: "Trust / logos strip",
      type: "stats",
      fields: [
        {
          key: "trust_label",
          label: "Strip label",
          type: "text",
          defaultValue: "Trusted by fast-moving teams everywhere",
        },
        {
          key: "logos",
          label: "Brand names",
          type: "list",
          itemLabel: "brand",
          minItems: 0,
          maxItems: 8,
          itemFields: [
            { key: "name", label: "Brand name", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { name: "Northwind" },
            { name: "Lumen" },
            { name: "Cascade" },
            { name: "Orbit" },
            { name: "Helix" },
          ],
        },
      ],
    },
    {
      id: "features",
      label: "Feature grid",
      type: "benefits",
      fields: [
        {
          key: "features_title",
          label: "Section title",
          type: "text",
          defaultValue: "Built for teams that ship",
        },
        {
          key: "features_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Powerful by default, simple to start — everything in one fast, modern workspace.",
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
              title: "Blazing fast",
              description: "A snappy, real-time interface that keeps up with your whole team.",
            },
            {
              icon: "🔌",
              title: "Connects to everything",
              description: "Native integrations and an open API so your stack just works.",
            },
            {
              icon: "🔒",
              title: "Secure by design",
              description: "Enterprise-grade encryption, SSO, and granular access controls.",
            },
          ],
        },
      ],
    },
    {
      id: "benefits",
      label: "Benefits (checkmarks)",
      type: "benefits",
      fields: [
        {
          key: "benefits_title",
          label: "Section title",
          type: "text",
          defaultValue: "Everything works out of the box",
        },
        {
          key: "benefits_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "No setup marathons, no plugins to wrangle. Sign up and start shipping in minutes.",
        },
        {
          key: "benefits",
          label: "Benefit lines",
          type: "list",
          itemLabel: "benefit",
          minItems: 1,
          maxItems: 8,
          itemFields: [
            { key: "text", label: "Benefit", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "Unlimited projects and team members on every plan" },
            { text: "Real-time sync across web, desktop, and mobile" },
            { text: "Automations that handle the repetitive work for you" },
            { text: "Export your data anytime — no lock-in, ever" },
          ],
        },
      ],
    },
    {
      id: "testimonial",
      label: "Testimonial",
      type: "benefits",
      fields: [
        {
          key: "testimonial_quote",
          label: "Quote",
          type: "textarea",
          defaultValue: "We replaced four tools with this in a single afternoon. Our team has never moved faster.",
        },
        {
          key: "testimonial_author",
          label: "Author name",
          type: "text",
          defaultValue: "Jordan Avery",
        },
        {
          key: "testimonial_role",
          label: "Author role / company",
          type: "text",
          defaultValue: "Head of Product, Cascade",
        },
      ],
    },
    {
      id: "capture",
      label: "Get early access",
      type: "form",
      category: "leads",
      fields: [
        {
          key: "capture_title",
          label: "Section title",
          type: "text",
          defaultValue: "Get early access",
        },
        {
          key: "capture_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Join the waitlist and be the first in when we open the doors — plus a founding-member discount.",
        },
        {
          key: "capture_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Get early access",
        },
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
        {
          key: "sticky_cta",
          label: "Mobile sticky button label",
          type: "text",
          defaultValue: "Get early access",
        },
      ],
    },
    designSection("midnight"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <SaasLandingPage
    pageId={pageId}
    slug={slug}
    product={product}
    products={products}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    hero_eyebrow={readField(values, "hero_eyebrow", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_primary_cta={readField(values, "hero_primary_cta", "")}
    hero_secondary_cta={readField(values, "hero_secondary_cta", "")}
    hero_screenshot_url={readField(values, "hero_screenshot_url", "") || undefined}
    hero_mockup_caption={readField(values, "hero_mockup_caption", "")}
    trust_label={readField(values, "trust_label", "")}
    logos={readField(values, "logos", [])}
    features_title={readField(values, "features_title", "")}
    features_subtitle={readField(values, "features_subtitle", "")}
    features={readField(values, "features", [])}
    benefits_title={readField(values, "benefits_title", "")}
    benefits_subtitle={readField(values, "benefits_subtitle", "")}
    benefits={readField(values, "benefits", [])}
    testimonial_quote={readField(values, "testimonial_quote", "")}
    testimonial_author={readField(values, "testimonial_author", "")}
    testimonial_role={readField(values, "testimonial_role", "")}
    capture_title={readField(values, "capture_title", "")}
    capture_subtitle={readField(values, "capture_subtitle", "")}
    capture_cta={readField(values, "capture_cta", "")}
    capture_privacy={readField(values, "capture_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    sticky_cta={readField(values, "sticky_cta", "")}
    theme_key={readField(values, "theme", "midnight")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const saasTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
