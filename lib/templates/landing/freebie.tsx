// Freebie / lead magnet — definition + adapter.

import { FreebieLeadPage } from "@/components/templates/FreebieLeadPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "freebie",
  name: "Free Download (Lead Magnet)",
  description: "Email opt-in page for a free download — checklists, ebooks, swipe files.",
  category: "lead_magnet",
  dbType: "lead_magnet",
  thumbnail: "/templates/freebie.svg",
  theme: { name: "Cream + Coral", primary: "#fb7185", background: "#fff7ed" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "badge_text", label: "Badge text", type: "text", defaultValue: "Free Download" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The 25-question cold-outreach swipe file",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue: "Battle-tested email questions that booked 312 sales calls last quarter.",
        },
      ],
    },
    {
      id: "inside",
      label: "What's inside",
      type: "benefits",
      fields: [
        { key: "inside_title", label: "Section title", type: "text", defaultValue: "What's inside" },
        {
          key: "inside_items",
          label: "Bullets",
          type: "list",
          itemLabel: "bullet",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "25 cold-outreach questions categorized by intent" },
            { text: "5 follow-up sequences you can copy-paste" },
            { text: "A scoring rubric so you stop wasting reps on dead leads" },
          ],
        },
      ],
    },
    {
      id: "optin",
      label: "Opt-in form",
      type: "form",
      fields: [
        { key: "optin_cta", label: "Button label", type: "text", defaultValue: "Send me the swipe file" },
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
          hint: "Direct download URL — buyer is taken straight to the file.",
        },
      ],
    },
    designSection("sunset"),
  ],
};

const Render: TemplateRender = ({ values, pageId, isPreview }) => (
  <FreebieLeadPage
    pageId={pageId}
    isPreview={isPreview}
    badge_text={readField(values, "badge_text", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    inside_title={readField(values, "inside_title", "")}
    inside_items={readField(values, "inside_items", [])}
    optin_cta={readField(values, "optin_cta", "")}
    optin_privacy={readField(values, "optin_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    theme_key={readField(values, "theme", "sunset")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const freebieTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
