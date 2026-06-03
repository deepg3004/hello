// Waitlist / "coming soon" pre-launch opt-in — definition + adapter.

import { WaitlistLeadPage } from "@/components/templates/WaitlistLeadPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "waitlist",
  name: "Waitlist (Coming Soon)",
  description:
    "Pre-launch \"coming soon\" page — build hype with a countdown, social proof and an early-access waitlist.",
  category: "lead_magnet",
  dbType: "lead_magnet",
  thumbnail: "",
  theme: { name: "Purple", primary: "#0088cc", background: "#1a0733" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "badge_text",
          label: "Badge text",
          type: "text",
          defaultValue: "Launching soon",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Something big is coming",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "We're putting the finishing touches on it. Join the waitlist to get early access — and be the first to know the moment we go live.",
        },
      ],
    },
    {
      id: "countdown",
      label: "Launch countdown",
      type: "advanced",
      fields: [
        {
          key: "countdown_enabled",
          label: "Show launch countdown",
          type: "toggle",
          defaultValue: true,
        },
        {
          key: "countdown_target",
          label: "Launch date/time (ISO)",
          type: "text",
          defaultValue: "",
          hint: 'Ends-at date, e.g. "2026-09-01T10:00:00Z". The timer hides once it passes.',
        },
        {
          key: "countdown_label",
          label: "Countdown label",
          type: "text",
          defaultValue: "Doors open in",
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
          label: "Waitlist count",
          type: "text",
          defaultValue: "2,400+",
          hint: 'Shown bold before the label, e.g. "2,400+".',
        },
        {
          key: "proof_label",
          label: "Proof label",
          type: "text",
          defaultValue: "already on the waitlist",
        },
      ],
    },
    {
      id: "perks",
      label: "Early-member perks",
      type: "benefits",
      fields: [
        {
          key: "perks_title",
          label: "Section title",
          type: "text",
          defaultValue: "Perks for early members",
        },
        {
          key: "perks_items",
          label: "Perks",
          type: "list",
          itemLabel: "perk",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "First access before anyone else on launch day" },
            { text: "An exclusive founding-member discount" },
            { text: "A say in what we build next" },
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
          defaultValue: "Reserve your spot",
        },
        {
          key: "optin_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Join the waitlist",
        },
        {
          key: "optin_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "We'll only email you about the launch. No spam, ever.",
        },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "Send new sign-ups to a thank-you / share page after they join.",
        },
      ],
    },
    designSection("purple"),
  ],
};

const Render: TemplateRender = ({ values, pageId, isPreview }) => (
  <WaitlistLeadPage
    pageId={pageId}
    isPreview={isPreview}
    badge_text={readField(values, "badge_text", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    countdown_enabled={!!readField(values, "countdown_enabled", false)}
    countdown_target={readField(values, "countdown_target", "") || undefined}
    countdown_label={readField(values, "countdown_label", "")}
    proof_count={readField(values, "proof_count", "")}
    proof_label={readField(values, "proof_label", "")}
    perks_title={readField(values, "perks_title", "")}
    perks_items={readField(values, "perks_items", [])}
    form_title={readField(values, "form_title", "")}
    optin_cta={readField(values, "optin_cta", "")}
    optin_privacy={readField(values, "optin_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    theme_key={readField(values, "theme", "purple")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const waitlistTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
