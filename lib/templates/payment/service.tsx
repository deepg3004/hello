// Service / consulting / done-for-you booking page — definition + adapter.

import { ServicePage } from "@/components/templates/ServicePage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "service",
  name: "Service / Done-For-You Page",
  description:
    "Premium booking page for a service, consulting offer, or done-for-you package — deliverables, process, outcomes, and a slot-booking checkout.",
  category: "payment",
  dbType: "payment",
  thumbnail: "",
  theme: { name: "Midnight", primary: "#3b82f6", background: "#0A1628" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow text", type: "text", defaultValue: "Done-for-you service" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "We build it for you, end to end — so you can focus on growing",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A fully managed, done-for-you engagement. You bring the goal; we handle the strategy, execution, and delivery — on time and to spec.",
        },
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Book your slot" },
        { key: "hero_image", label: "Provider photo URL", type: "image", defaultValue: "" },
        { key: "hero_provider_name", label: "Provider name", type: "text", defaultValue: "Alex Morgan" },
        { key: "hero_provider_role", label: "Provider role / title", type: "text", defaultValue: "Lead Consultant" },
      ],
    },
    {
      id: "included",
      label: "What's included",
      type: "benefits",
      fields: [
        { key: "included_title", label: "Section title", type: "text", defaultValue: "What's included" },
        {
          key: "included_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Every engagement includes the full set of deliverables below — nothing held back.",
        },
        {
          key: "included_items",
          label: "Deliverables",
          type: "list",
          itemLabel: "deliverable",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "text", label: "Deliverable", type: "text", defaultValue: "" },
            { key: "description", label: "Short description", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "Discovery & strategy session", description: "We map your goals, constraints, and success metrics." },
            { text: "Full done-for-you build", description: "We execute the entire scope — you review, not build." },
            { text: "Weekly progress updates", description: "Clear, async updates so you always know where things stand." },
            { text: "Final delivery & handoff", description: "Everything packaged, documented, and ready to use." },
            { text: "30-day post-launch support", description: "We stick around to fix, tweak, and polish." },
            { text: "Source files & assets", description: "You own everything we produce." },
          ],
        },
      ],
    },
    {
      id: "process",
      label: "How it works",
      type: "benefits",
      fields: [
        { key: "process_title", label: "Section title", type: "text", defaultValue: "How it works" },
        {
          key: "process_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "A simple, three-step process from booking to delivery.",
        },
        {
          key: "process_steps",
          label: "Process steps",
          type: "list",
          itemLabel: "step",
          minItems: 1,
          maxItems: 6,
          itemFields: [
            { key: "title", label: "Step title", type: "text", defaultValue: "" },
            { key: "description", label: "Step description", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { title: "Book your slot", description: "Reserve your spot and complete a short intake form." },
            { title: "Kickoff & strategy", description: "We align on scope, timeline, and the outcome you want." },
            { title: "Build & deliver", description: "We execute, keep you updated, and hand off the finished work." },
          ],
        },
      ],
    },
    {
      id: "stats",
      label: "Outcomes & stats",
      type: "benefits",
      fields: [
        { key: "stats_title", label: "Section title", type: "text", defaultValue: "Results that speak for themselves" },
        {
          key: "stats_items",
          label: "Stats",
          type: "list",
          itemLabel: "stat",
          minItems: 0,
          maxItems: 4,
          itemFields: [
            { key: "value", label: "Value", type: "text", defaultValue: "" },
            { key: "label", label: "Label", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { value: "120+", label: "Projects delivered" },
            { value: "4.9/5", label: "Average client rating" },
            { value: "14 days", label: "Typical turnaround" },
            { value: "98%", label: "Would recommend" },
          ],
        },
      ],
    },
    {
      id: "proof",
      label: "Testimonials",
      type: "testimonials",
      fields: [
        { key: "testimonials_title", label: "Section title", type: "text", defaultValue: "What clients say" },
        {
          key: "testimonials_items",
          label: "Testimonials",
          type: "list",
          itemLabel: "testimonial",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "quote", label: "Quote", type: "textarea", defaultValue: "" },
            { key: "author", label: "Author", type: "text", defaultValue: "" },
            { key: "role", label: "Role", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            {
              quote: "They took the whole thing off my plate and delivered better than I imagined. Worth every rupee.",
              author: "Priya N.",
              role: "Founder, D2C brand",
            },
            {
              quote: "Clear process, zero hand-holding needed on my end, and the final result was exactly on brief.",
              author: "Rahul K.",
              role: "Head of Growth",
            },
            {
              quote: "Fast, professional, and the post-launch support sealed it. I've already booked a second project.",
              author: "Ananya S.",
              role: "Solo creator",
            },
            {
              quote: "Finally a done-for-you team that actually does it for you. Communication was flawless.",
              author: "Vikram T.",
              role: "Agency owner",
            },
          ],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      fields: [
        { key: "checkout_title", label: "Section title", type: "text", defaultValue: "Book your slot" },
        {
          key: "checkout_billing_note",
          label: "Billing note (next to price)",
          type: "text",
          defaultValue: "one-time",
          hint: 'e.g. "one-time", "/ project", or "to reserve".',
        },
        { key: "checkout_features_title", label: "Features list title", type: "text", defaultValue: "Your booking includes" },
        {
          key: "checkout_features",
          label: "Checkout features",
          type: "list",
          itemLabel: "feature",
          minItems: 0,
          maxItems: 8,
          itemFields: [{ key: "text", label: "Feature", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "Reserved project slot" },
            { text: "Kickoff strategy session" },
            { text: "Full done-for-you delivery" },
            { text: "30-day post-launch support" },
          ],
        },
        {
          key: "checkout_guarantee",
          label: "Guarantee line",
          type: "text",
          defaultValue: "Satisfaction guaranteed. If the first deliverable misses the brief, we revise it free.",
        },
      ],
    },
    designSection("midnight"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <ServicePage
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
    hero_image={readField(values, "hero_image", "")}
    hero_provider_name={readField(values, "hero_provider_name", "")}
    hero_provider_role={readField(values, "hero_provider_role", "")}
    included_title={readField(values, "included_title", "")}
    included_subtitle={readField(values, "included_subtitle", "")}
    included_items={readField(values, "included_items", [])}
    process_title={readField(values, "process_title", "")}
    process_subtitle={readField(values, "process_subtitle", "")}
    process_steps={readField(values, "process_steps", [])}
    stats_title={readField(values, "stats_title", "")}
    stats_items={readField(values, "stats_items", [])}
    testimonials_title={readField(values, "testimonials_title", "")}
    testimonials_items={readField(values, "testimonials_items", [])}
    checkout_title={readField(values, "checkout_title", "")}
    checkout_billing_note={readField(values, "checkout_billing_note", "")}
    checkout_features_title={readField(values, "checkout_features_title", "")}
    checkout_features={readField(values, "checkout_features", [])}
    checkout_guarantee={readField(values, "checkout_guarantee", "")}
    theme_key={readField(values, "theme", "midnight")}
    bg_animation={readField(values, "bg_animation", "none")}
  />
);

export const serviceTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
