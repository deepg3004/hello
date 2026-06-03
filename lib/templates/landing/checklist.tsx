// Checklist / cheatsheet — definition + adapter.

import { ChecklistLeadPage } from "@/components/templates/ChecklistLeadPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "checklist",
  name: "Checklist / Cheatsheet (Lead Magnet)",
  description:
    "Two-column opt-in for a downloadable checklist — opt-in left, a visual checklist preview right.",
  category: "lead_magnet",
  dbType: "lead_magnet",
  thumbnail: "",
  theme: { name: "Emerald", primary: "#10b981", background: "#022c22" },
  sections: [
    {
      id: "hero",
      label: "Hero & opt-in",
      type: "hero",
      category: "leads",
      fields: [
        {
          key: "badge_text",
          label: "Badge text",
          type: "text",
          defaultValue: "Free Checklist",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The 12-point launch-day checklist",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Everything you must tick off before you hit publish — so nothing slips through the cracks on launch day.",
        },
        {
          key: "optin_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Send me the checklist",
        },
        {
          key: "optin_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "No spam. Unsubscribe in one click.",
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
    {
      id: "preview",
      label: "Checklist preview",
      type: "benefits",
      category: "landing",
      fields: [
        {
          key: "preview_title",
          label: "Preview card title",
          type: "text",
          defaultValue: "Inside the checklist",
        },
        {
          key: "preview_label",
          label: "Preview card subtitle",
          type: "text",
          defaultValue: "A sneak peek at what you'll get",
        },
        {
          key: "checklist_items",
          label: "Sample checklist items",
          type: "list",
          itemLabel: "checklist item",
          itemFields: [{ key: "text", label: "Item", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "Proofread every headline and CTA twice" },
            { text: "Test the checkout flow end-to-end" },
            { text: "Schedule your launch-day email sequence" },
            { text: "Warm up your audience 48 hours ahead" },
            { text: "Set up conversion tracking + pixels" },
          ],
        },
      ],
    },
    {
      id: "why",
      label: "Why it helps",
      type: "benefits",
      category: "landing",
      fields: [
        {
          key: "why_title",
          label: "Strip title",
          type: "text",
          defaultValue: "Why this checklist helps",
        },
        {
          key: "why_points",
          label: "Reasons (3 points)",
          type: "list",
          itemLabel: "reason",
          itemFields: [
            { key: "title", label: "Title", type: "text", defaultValue: "" },
            { key: "body", label: "Description", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            {
              title: "Nothing forgotten",
              body: "A clear step-by-step list so no critical task slips through on the day.",
            },
            {
              title: "Save hours",
              body: "Skip the trial-and-error — follow a process that's already been proven.",
            },
            {
              title: "Launch with confidence",
              body: "Hit publish knowing every box is ticked and your setup is solid.",
            },
          ],
        },
      ],
    },
    designSection("emerald"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, isPreview, bumpRuntime }) => (
  <ChecklistLeadPage
    pageId={pageId}
    slug={slug}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    badge_text={readField(values, "badge_text", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    optin_cta={readField(values, "optin_cta", "")}
    optin_privacy={readField(values, "optin_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    preview_title={readField(values, "preview_title", "")}
    preview_label={readField(values, "preview_label", "")}
    checklist_items={readField(values, "checklist_items", [])}
    why_title={readField(values, "why_title", "")}
    why_points={readField(values, "why_points", [])}
    theme_key={readField(values, "theme", "emerald")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const checklistTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
