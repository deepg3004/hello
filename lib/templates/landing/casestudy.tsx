// Gated case study / report / free guide — definition + adapter.

import { CaseStudyLeadPage } from "@/components/templates/CaseStudyLeadPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "casestudy",
  name: "Case Study / Report (Lead Magnet)",
  description:
    "Gated B2B case-study download — a value pitch with a 'what you'll discover' list on the left, a sticky white opt-in card on the right.",
  category: "lead_magnet",
  dbType: "lead_magnet",
  thumbnail: "",
  theme: { name: "Emerald", primary: "#10b981", background: "#022c22" },
  sections: [
    {
      id: "hero",
      label: "Hero & pitch",
      type: "hero",
      category: "landing",
      fields: [
        {
          key: "badge_text",
          label: "Badge text",
          type: "text",
          defaultValue: "Free case study",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "How a 7-figure brand 3x'd qualified leads in 90 days",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A step-by-step breakdown of the exact playbook — channels, messaging, and the funnel that turned cold traffic into booked demos.",
        },
        {
          key: "discover_title",
          label: "Discover list title",
          type: "text",
          defaultValue: "What you'll discover inside",
        },
        {
          key: "discover_bullets",
          label: "What you'll discover (bullets)",
          type: "list",
          itemLabel: "bullet",
          itemFields: [{ key: "text", label: "Bullet", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "The 3-channel acquisition mix that drove 80% of pipeline" },
            { text: "The exact outbound messaging that doubled reply rates" },
            { text: "How the funnel was restructured to qualify leads faster" },
            { text: "The reporting setup used to prove ROI to the board" },
          ],
        },
        {
          key: "stat_value",
          label: "Result stat — value",
          type: "text",
          defaultValue: "312%",
          hint: "Big number for the result callout, e.g. 312% or $1.4M.",
        },
        {
          key: "stat_label",
          label: "Result stat — label",
          type: "text",
          defaultValue: "How Acme grew qualified pipeline in one quarter",
        },
      ],
    },
    {
      id: "optin",
      label: "Opt-in card",
      type: "leads",
      category: "leads",
      fields: [
        {
          key: "form_eyebrow",
          label: "Card eyebrow",
          type: "text",
          defaultValue: "Instant access",
        },
        {
          key: "form_title",
          label: "Card title",
          type: "text",
          defaultValue: "Get the full case study",
        },
        {
          key: "optin_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Get the case study",
        },
        {
          key: "optin_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "We'll only use your email to send the report. Unsubscribe anytime.",
        },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "Direct download URL — the lead is taken straight to the file.",
        },
      ],
    },
    {
      id: "trust",
      label: "Trust / logos strip",
      type: "benefits",
      category: "landing",
      fields: [
        {
          key: "logos_title",
          label: "Strip title",
          type: "text",
          defaultValue: "Trusted by teams at",
        },
        {
          key: "trust_logos",
          label: "Logos / company names",
          type: "list",
          itemLabel: "company",
          itemFields: [{ key: "name", label: "Company", type: "text", defaultValue: "" }],
          defaultValue: [
            { name: "Northwind" },
            { name: "Acme Co" },
            { name: "Lumen" },
            { name: "Vantage" },
            { name: "Helix" },
          ],
        },
      ],
    },
    designSection("emerald"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, isPreview, bumpRuntime }) => (
  <CaseStudyLeadPage
    pageId={pageId}
    slug={slug}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    badge_text={readField(values, "badge_text", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    discover_title={readField(values, "discover_title", "")}
    discover_bullets={readField(values, "discover_bullets", [])}
    stat_value={readField(values, "stat_value", "")}
    stat_label={readField(values, "stat_label", "")}
    form_eyebrow={readField(values, "form_eyebrow", "")}
    form_title={readField(values, "form_title", "")}
    optin_cta={readField(values, "optin_cta", "")}
    optin_privacy={readField(values, "optin_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    logos_title={readField(values, "logos_title", "")}
    trust_logos={readField(values, "trust_logos", [])}
    theme_key={readField(values, "theme", "emerald")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const casestudyTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
