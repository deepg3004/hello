// Coaching / consulting — definition + adapter.

import { PaymentCoachingPage } from "@/components/templates/PaymentCoachingPage";
import type { TimerConfig } from "@/components/templates/shared/types";
import { extractDefaults, readField } from "@/lib/templates/utils";
import { designSection } from "@/lib/templates/design";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "coaching",
  name: "Coaching / Consulting",
  description: "Premium consulting/coaching page with authority framing.",
  category: "payment",
  dbType: "payment",
  thumbnail: "/templates/coaching.svg",
  theme: { name: "Charcoal + Orange", primary: "#f97316", background: "#18181b" },
  sections: [
    {
      id: "urgency",
      label: "Urgency banner",
      type: "banner",
      fields: [
        { key: "urgency_enabled", label: "Show banner", type: "toggle", defaultValue: true },
        { key: "urgency_text", label: "Banner text", type: "text", defaultValue: "Only 5 spots open this month" },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "hero_headline",
          label: "Authority headline",
          type: "text",
          defaultValue: "Cut your launch timeline in half — with 1:1 coaching from a 7-figure founder",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "I've shipped 14 products to 500K+ users. Now I help founders go from idea to revenue in 90 days.",
        },
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Book a strategy call" },
      ],
    },
    {
      id: "what_you_get",
      label: "What you get",
      type: "benefits",
      fields: [
        { key: "wyg_title", label: "Section title", type: "text", defaultValue: "Here's what you get" },
        {
          key: "wyg_items",
          label: "Deliverables",
          type: "list",
          itemLabel: "deliverable",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "12 weekly 1:1 calls (60 min each)" },
            { text: "Slack channel for between-session questions" },
            { text: "Weekly written feedback on your KPIs" },
            { text: "Templates, scripts, and playbooks I actually use" },
            { text: "Intros to investors and operators in my network" },
          ],
        },
      ],
    },
    {
      id: "social_proof",
      label: "Social proof numbers",
      type: "metrics",
      fields: [
        { key: "metric1_value", label: "Metric 1 value", type: "text", defaultValue: "120+" },
        { key: "metric1_label", label: "Metric 1 label", type: "text", defaultValue: "founders coached" },
        { key: "metric2_value", label: "Metric 2 value", type: "text", defaultValue: "10 yrs" },
        { key: "metric2_label", label: "Metric 2 label", type: "text", defaultValue: "as a founder + operator" },
        { key: "metric3_value", label: "Metric 3 value", type: "text", defaultValue: "$40M+" },
        { key: "metric3_label", label: "Metric 3 label", type: "text", defaultValue: "in revenue I've helped clients ship" },
      ],
    },
    {
      id: "who",
      label: "Is this for you?",
      type: "audience",
      fields: [
        { key: "who_title", label: "Section title", type: "text", defaultValue: "Is this for you?" },
        {
          // YES column — keeps the legacy `who_items` key so existing pages
          // don't lose their data on this redesign.
          key: "who_items",
          label: "✅ This IS for you if…",
          type: "list",
          itemLabel: "audience",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "First-time founders who want to skip the dumb mistakes" },
            { text: "Operators going indie for the first time" },
            { text: "Side-project builders ready to commit full-time" },
          ],
        },
        {
          // NO column — new field powering the second "is this NOT for you" list.
          key: "forme_no_items",
          label: "❌ This is NOT for you if…",
          type: "list",
          itemLabel: "exclusion",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "You're looking for a one-call magic fix" },
            { text: "You won't put in 4–6 hours of work each week" },
            { text: "You expect templates without thinking through the why" },
          ],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      fields: [
        { key: "checkout_title", label: "Section title", type: "text", defaultValue: "Reserve your spot" },
        { key: "checkout_note", label: "Note", type: "text", defaultValue: "Discovery call within 48h of booking." },
      ],
    },
    {
      id: "advanced",
      label: "Conversion boosters",
      type: "advanced",
      fields: [
        { key: "timer_enabled", label: "Show countdown timer", type: "toggle", defaultValue: false },
        { key: "timer_target", label: "Timer ends at (ISO date)", type: "text", defaultValue: "" },
        { key: "timer_label", label: "Timer label", type: "text", defaultValue: "Cohort closes in" },
        { key: "social_proof_enabled", label: "Show recent buyer popups", type: "toggle", defaultValue: false },
      ],
    },
    designSection("sunset"),
  ],
};

const Render: TemplateRender = ({ values, pageId, product, isPreview, bumpRuntime }) => {
  const timer: TimerConfig = {
    enabled: !!readField(values, "timer_enabled", false),
    target: readField(values, "timer_target", "") || undefined,
    label: readField(values, "timer_label", "") || undefined,
  };
  return (
    <PaymentCoachingPage
      pageId={pageId}
      product={product}
      isPreview={isPreview}
      bumpRuntime={bumpRuntime}
      timer={timer}
      socialProofEnabled={!!readField(values, "social_proof_enabled", false)}
      urgency_enabled={!!readField(values, "urgency_enabled", false)}
      urgency_text={readField(values, "urgency_text", "")}
      hero_headline={readField(values, "hero_headline", "")}
      hero_subheadline={readField(values, "hero_subheadline", "")}
      hero_cta={readField(values, "hero_cta", "")}
      wyg_title={readField(values, "wyg_title", "")}
      wyg_items={readField(values, "wyg_items", [])}
      metric1_value={readField(values, "metric1_value", "")}
      metric1_label={readField(values, "metric1_label", "")}
      metric2_value={readField(values, "metric2_value", "")}
      metric2_label={readField(values, "metric2_label", "")}
      metric3_value={readField(values, "metric3_value", "")}
      metric3_label={readField(values, "metric3_label", "")}
      who_title={readField(values, "who_title", "")}
      who_items={readField(values, "who_items", [])}
      forme_no_items={readField(values, "forme_no_items", [])}
      checkout_title={readField(values, "checkout_title", "")}
      checkout_note={readField(values, "checkout_note", "")}
      theme_key={readField(values, "theme", "sunset")}
      bg_animation={readField(values, "bg_animation", "none")}
    />
  );
};

export const coachingTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
