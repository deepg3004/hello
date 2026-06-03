// Webinar registration — definition + adapter.

import { LandingWebinarPage } from "@/components/templates/LandingWebinarPage";
import type { TimerConfig } from "@/components/templates/shared/types";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "webinar",
  name: "Webinar Registration",
  description: "Live-or-replay webinar opt-in with date banner and host bio.",
  category: "landing",
  dbType: "landing",
  thumbnail: "/templates/webinar.svg",
  theme: { name: "Indigo + Cyan", primary: "#6366f1", background: "#0b0b14" },
  sections: [
    {
      id: "banner",
      label: "Date / time banner",
      type: "banner",
      fields: [
        { key: "banner_text", label: "Banner text", type: "text", defaultValue: "Live · Thursday 7 Jun, 7:00 PM IST" },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "How to ship your SaaS in 90 days (without burning out)",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue: "A 60-minute live session with Q&A. Replay sent to everyone who registers.",
        },
      ],
    },
    {
      id: "host",
      label: "Host",
      type: "instructor",
      fields: [
        { key: "host_name", label: "Host name", type: "text", defaultValue: "Your name" },
        { key: "host_title", label: "Host title", type: "text", defaultValue: "Founder · 7-figure SaaS" },
        {
          key: "host_bio",
          label: "Host bio",
          type: "textarea",
          defaultValue: "I've launched 14 products. This is the framework I now use for every new one.",
        },
        { key: "host_avatar", label: "Host avatar URL", type: "image", defaultValue: "" },
      ],
    },
    {
      id: "agenda",
      label: "What you'll learn",
      type: "benefits",
      fields: [
        { key: "agenda_title", label: "Section title", type: "text", defaultValue: "What you'll learn" },
        {
          key: "agenda_items",
          label: "Bullets",
          type: "list",
          itemLabel: "lesson",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "The 4-stage ship-it framework I use for every product" },
            { text: "How to validate ideas in 48 hours" },
            { text: "The exact tools, ad scripts, and pricing model that work today" },
          ],
        },
      ],
    },
    {
      id: "register",
      label: "Registration form",
      type: "form",
      fields: [
        { key: "register_title", label: "Section title", type: "text", defaultValue: "Reserve your seat" },
        { key: "register_cta", label: "Button label", type: "text", defaultValue: "Register free" },
        { key: "register_count_label", label: "Social proof line", type: "text", defaultValue: "1,247 founders already registered" },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "e.g. https://meet.google.com/abc-defg-hij",
        },
      ],
    },
    {
      id: "advanced",
      label: "Conversion boosters",
      type: "advanced",
      fields: [
        { key: "timer_enabled", label: "Show countdown to webinar", type: "toggle", defaultValue: false },
        { key: "timer_target", label: "Webinar start (ISO date)", type: "text", defaultValue: "" },
        { key: "timer_label", label: "Timer label", type: "text", defaultValue: "Live in" },
      ],
    },
    designSection("purple"),
  ],
};

const Render: TemplateRender = ({ values, pageId, isPreview }) => {
  const timer: TimerConfig = {
    enabled: !!readField(values, "timer_enabled", false),
    target: readField(values, "timer_target", "") || undefined,
    label: readField(values, "timer_label", "") || undefined,
  };
  return (
    <LandingWebinarPage
      pageId={pageId}
      isPreview={isPreview}
      timer={timer}
      banner_text={readField(values, "banner_text", "")}
      hero_headline={readField(values, "hero_headline", "")}
      hero_subheadline={readField(values, "hero_subheadline", "")}
      host_name={readField(values, "host_name", "")}
      host_title={readField(values, "host_title", "")}
      host_bio={readField(values, "host_bio", "")}
      host_avatar={readField(values, "host_avatar", "")}
      agenda_title={readField(values, "agenda_title", "")}
      agenda_items={readField(values, "agenda_items", [])}
      register_title={readField(values, "register_title", "")}
      register_cta={readField(values, "register_cta", "")}
      register_count_label={readField(values, "register_count_label", "")}
      redirect_url={readField(values, "redirect_url", "") || undefined}
      formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
      theme_key={readField(values, "theme", "purple")}
      bg_animation={readField(values, "bg_animation", "none")}
    />
  );
};

export const webinarTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
