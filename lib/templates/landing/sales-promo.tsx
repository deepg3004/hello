// Limited-time sales / promo landing — definition + adapter.

import { SalesPromoPage } from "@/components/templates/SalesPromoPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "sales-promo",
  name: "Limited-Time Offer",
  description: "Urgency-driven promo page with a live countdown, value stack, and email capture.",
  category: "landing",
  dbType: "landing",
  thumbnail: "",
  theme: { name: "Sunset", primary: "#fb923c", background: "#1f1020" },
  sections: [
    {
      id: "urgency",
      label: "Urgency banner",
      type: "banner",
      fields: [
        { key: "urgency_enabled", label: "Show urgency banner", type: "toggle", defaultValue: true },
        {
          key: "urgency_text",
          label: "Banner text",
          type: "text",
          defaultValue: "Flash sale ends tonight — 50% off everything",
        },
      ],
    },
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "badge_text", label: "Badge text", type: "text", defaultValue: "Limited-Time Offer" },
        {
          key: "hero_headline",
          label: "Offer headline",
          type: "text",
          defaultValue: "Get the complete toolkit for half price — this week only",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Everything you need to launch, all in one bundle. The price goes back up the moment the timer hits zero.",
        },
        { key: "hero_cta", label: "Hero button label", type: "text", defaultValue: "Claim the offer" },
        {
          key: "offer_ends_at",
          label: "Offer end date (ISO)",
          type: "text",
          defaultValue: "",
          hint: "When the deal expires, e.g. 2026-06-09T23:59:00+05:30. Drives the countdown.",
        },
        { key: "countdown_label", label: "Countdown label", type: "text", defaultValue: "Offer ends in" },
      ],
    },
    {
      id: "value",
      label: "What you get",
      type: "benefits",
      fields: [
        { key: "value_title", label: "Section title", type: "text", defaultValue: "Here's everything you get" },
        {
          key: "value_items",
          label: "Value stack",
          type: "list",
          itemLabel: "item",
          itemFields: [
            { key: "text", label: "Item", type: "text", defaultValue: "" },
            { key: "worth", label: "Crossed-out worth (optional)", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "The full core program (12 modules)", worth: "$297 value" },
            { text: "Plug-and-play templates & swipe files", worth: "$97 value" },
            { text: "Private community access for 12 months", worth: "$149 value" },
            { text: "Bonus: 1:1 onboarding call", worth: "$199 value" },
          ],
        },
        {
          key: "value_total_label",
          label: "Total-value line",
          type: "text",
          defaultValue: "Total value $742 — yours today for $97",
        },
      ],
    },
    {
      id: "reasons",
      label: "Why act now (before / after)",
      type: "benefits",
      fields: [
        { key: "reasons_title", label: "Section title", type: "text", defaultValue: "Why act now" },
        {
          key: "reasons_items",
          label: "Before / after reasons",
          type: "list",
          itemLabel: "reason",
          itemFields: [
            { key: "before", label: "Before (the pain)", type: "text", defaultValue: "" },
            { key: "after", label: "After (the win)", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            {
              before: "Piecing it together from scattered free tutorials",
              after: "One proven, step-by-step system in one place",
            },
            {
              before: "Paying full price next week when it goes back up",
              after: "Locking in 50% off before the timer ends",
            },
            {
              before: "Guessing what actually works",
              after: "Following the exact playbook that's already worked",
            },
            {
              before: "Starting alone with no support",
              after: "A community + onboarding call to keep you moving",
            },
          ],
        },
      ],
    },
    {
      id: "faq",
      label: "FAQ",
      type: "faq",
      fields: [
        { key: "faq_title", label: "Section title", type: "text", defaultValue: "Questions, answered" },
        {
          key: "faq_items",
          label: "FAQ items",
          type: "list",
          itemLabel: "question",
          itemFields: [
            { key: "q", label: "Question", type: "text", defaultValue: "" },
            { key: "a", label: "Answer", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            {
              q: "What happens when the timer runs out?",
              a: "The discount disappears and the price returns to full. Claim now to lock in the offer.",
            },
            {
              q: "Do I get instant access?",
              a: "Yes — you'll get an email with everything the moment you sign up.",
            },
            {
              q: "Is there a guarantee?",
              a: "Absolutely. If it's not for you, reply within 14 days for a full refund.",
            },
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
        { key: "capture_eyebrow", label: "Eyebrow text", type: "text", defaultValue: "Lock in this price" },
        { key: "capture_title", label: "Form title", type: "text", defaultValue: "Claim your spot" },
        {
          key: "capture_subtitle",
          label: "Form subtitle",
          type: "text",
          defaultValue: "Drop your email and we'll send you everything right away.",
        },
        { key: "capture_cta", label: "Submit button label", type: "text", defaultValue: "Claim the offer" },
        {
          key: "capture_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "No spam, ever. Unsubscribe in one click.",
        },
        { key: "sticky_cta", label: "Sticky mobile button label", type: "text", defaultValue: "Claim 50% off" },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "Send the buyer straight to a checkout or download URL.",
        },
      ],
    },
    designSection("sunset"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, isPreview }) => (
  <SalesPromoPage
    pageId={pageId}
    slug={slug}
    isPreview={isPreview}
    urgency_enabled={!!readField(values, "urgency_enabled", true)}
    urgency_text={readField(values, "urgency_text", "")}
    badge_text={readField(values, "badge_text", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_cta={readField(values, "hero_cta", "")}
    offer_ends_at={readField(values, "offer_ends_at", "") || undefined}
    countdown_label={readField(values, "countdown_label", "")}
    value_title={readField(values, "value_title", "")}
    value_items={readField(values, "value_items", [])}
    value_total_label={readField(values, "value_total_label", "")}
    reasons_title={readField(values, "reasons_title", "")}
    reasons_items={readField(values, "reasons_items", [])}
    faq_title={readField(values, "faq_title", "")}
    faq_items={readField(values, "faq_items", [])}
    capture_eyebrow={readField(values, "capture_eyebrow", "")}
    capture_title={readField(values, "capture_title", "")}
    capture_subtitle={readField(values, "capture_subtitle", "")}
    capture_cta={readField(values, "capture_cta", "")}
    capture_privacy={readField(values, "capture_privacy", "")}
    sticky_cta={readField(values, "sticky_cta", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
    theme_key={readField(values, "theme", "sunset")}
    bg_animation={readField(values, "bg_animation", "none")}
  />
);

export const salesPromoTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
