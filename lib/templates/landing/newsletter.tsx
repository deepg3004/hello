// Newsletter / email-list signup — definition + adapter.

import { NewsletterLeadPage } from "@/components/templates/NewsletterLeadPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "newsletter",
  name: "Newsletter Signup (Lead Magnet)",
  description: "Clean email-list opt-in page — grow a weekly newsletter audience.",
  category: "lead_magnet",
  dbType: "lead_magnet",
  thumbnail: "",
  theme: { name: "Telegram Blue", primary: "#29b6f6", background: "#00344f" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "badge_text", label: "Badge text", type: "text", defaultValue: "Free Newsletter" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Join 10,000+ readers",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "One sharp email every week — the ideas, tools and tactics that actually move the needle. No fluff.",
        },
      ],
    },
    {
      id: "proof",
      label: "Social proof",
      type: "benefits",
      fields: [
        {
          key: "proof_count",
          label: "Subscriber count",
          type: "text",
          defaultValue: "10,000+",
          hint: 'Shown bold before the label, e.g. "10,000+".',
        },
        {
          key: "proof_label",
          label: "Proof label",
          type: "text",
          defaultValue: "readers every week",
        },
      ],
    },
    {
      id: "perks",
      label: "What you'll get",
      type: "benefits",
      fields: [
        {
          key: "perks_title",
          label: "Section title",
          type: "text",
          defaultValue: "What you'll get each week",
        },
        {
          key: "perks_items",
          label: "Bullets",
          type: "list",
          itemLabel: "bullet",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "One actionable idea you can use the same day" },
            { text: "A curated tool or resource worth your time" },
            { text: "Behind-the-scenes notes you won't find anywhere else" },
          ],
        },
      ],
    },
    {
      id: "optin",
      label: "Opt-in form",
      type: "form",
      fields: [
        {
          key: "form_title",
          label: "Form heading",
          type: "text",
          defaultValue: "Get the next issue in your inbox",
        },
        {
          key: "optin_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Subscribe — it's free",
        },
        {
          key: "optin_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "We'll never spam you. Unsubscribe in one click.",
        },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "Send new subscribers to a welcome page after they confirm.",
        },
      ],
    },
    designSection("telegram"),
  ],
};

const Render: TemplateRender = ({ values, pageId, isPreview }) => (
  <NewsletterLeadPage
    pageId={pageId}
    isPreview={isPreview}
    badge_text={readField(values, "badge_text", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    proof_count={readField(values, "proof_count", "")}
    proof_label={readField(values, "proof_label", "")}
    perks_title={readField(values, "perks_title", "")}
    perks_items={readField(values, "perks_items", [])}
    form_title={readField(values, "form_title", "")}
    optin_cta={readField(values, "optin_cta", "")}
    optin_privacy={readField(values, "optin_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    theme_key={readField(values, "theme", "telegram")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const newsletterTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
