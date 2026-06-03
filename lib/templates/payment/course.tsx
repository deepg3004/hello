// Course sales page — definition + adapter to the polished component.

import { PaymentCoursePage } from "@/components/templates/PaymentCoursePage";
import type { OrderBumpConfig, TimerConfig } from "@/components/templates/shared/types";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "course",
  name: "Course Sales Page",
  description: "Premium dark/gold sales page for online courses.",
  category: "payment",
  dbType: "payment",
  thumbnail: "/templates/course.svg",
  theme: { name: "Navy + Gold", primary: "#d4af37", background: "#0a1828" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow text", type: "text", defaultValue: "Online Course" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Master React in 30 days — even if you've never coded before",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A step-by-step program that takes you from absolute beginner to building production apps.",
        },
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Enrol Now" },
        { key: "hero_image", label: "Hero image URL", type: "image", defaultValue: "" },
      ],
    },
    {
      id: "benefits",
      label: "Benefits",
      type: "benefits",
      fields: [
        { key: "benefits_title", label: "Section title", type: "text", defaultValue: "What you'll get" },
        {
          key: "benefits_items",
          label: "Benefit bullets",
          type: "list",
          itemLabel: "benefit",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "30+ hours of practical video lessons" },
            { text: "10 real-world projects you'll build with me" },
            { text: "Lifetime access plus all future updates" },
            { text: "Private community of 2,000+ learners" },
            { text: "Certificate of completion" },
          ],
        },
      ],
    },
    {
      id: "instructor",
      label: "Instructor",
      type: "instructor",
      fields: [
        { key: "instructor_name", label: "Name", type: "text", defaultValue: "Your name" },
        { key: "instructor_title", label: "Title", type: "text", defaultValue: "Senior Engineer · 10+ years" },
        {
          key: "instructor_bio",
          label: "Short bio",
          type: "textarea",
          defaultValue:
            "I've shipped React apps used by millions and now I teach the exact playbook I use day to day.",
        },
        { key: "instructor_avatar", label: "Avatar image URL", type: "image", defaultValue: "" },
      ],
    },
    {
      id: "testimonials",
      label: "Testimonials",
      type: "testimonials",
      fields: [
        { key: "testimonials_title", label: "Section title", type: "text", defaultValue: "What students are saying" },
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
              quote:
                "I landed my first dev job within 2 months of finishing this. Hands down the best course I've ever taken.",
              author: "Priya S.",
              role: "Frontend Developer",
            },
            {
              quote: "The projects alone are worth 10x the price. Real code, real apps, no fluff.",
              author: "Rahul K.",
              role: "Full-stack Engineer",
            },
            {
              quote: "Finally a course that doesn't waste your time. Tight, practical, immediately useful.",
              author: "Anita M.",
              role: "Product Designer turned Dev",
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
        { key: "faq_title", label: "Section title", type: "text", defaultValue: "Frequently asked questions" },
        {
          key: "faq_items",
          label: "FAQs",
          type: "list",
          itemLabel: "Q&A",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "q", label: "Question", type: "text", defaultValue: "" },
            { key: "a", label: "Answer", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            { q: "Do I need prior coding experience?", a: "Nope. We start from absolute zero — variables, functions, the works." },
            { q: "How long do I have access?", a: "Forever. One payment, lifetime access including updates." },
            { q: "Will this work on my laptop?", a: "Yes — anything from the last 5 years runs the toolchain comfortably." },
            { q: "Is there a refund policy?", a: "14-day no-questions-asked refund. Just email us." },
            { q: "Will you help me when I'm stuck?", a: "Yes — the private community is monitored daily by me and senior students." },
          ],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      fields: [
        { key: "checkout_title", label: "Section title", type: "text", defaultValue: "Enrol today" },
        { key: "checkout_guarantee", label: "Guarantee line", type: "text", defaultValue: "14-day money-back guarantee. No questions asked." },
      ],
    },
    {
      id: "advanced",
      label: "Conversion boosters",
      type: "advanced",
      fields: [
        { key: "timer_enabled", label: "Show countdown timer", type: "toggle", defaultValue: false },
        { key: "timer_target", label: "Timer ends at (ISO date)", type: "text", defaultValue: "", hint: "e.g. 2026-06-30T23:59:00+05:30" },
        { key: "timer_label", label: "Timer label", type: "text", defaultValue: "Offer ends in" },
        { key: "social_proof_enabled", label: "Show recent buyer popups", type: "toggle", defaultValue: false },
        { key: "bump_enabled", label: "Show order bump", type: "toggle", defaultValue: false },
        { key: "bump_title", label: "Bump title", type: "text", defaultValue: "Add the workbook" },
        { key: "bump_description", label: "Bump description", type: "text", defaultValue: "120-page printable workbook." },
        { key: "bump_price", label: "Bump price (INR)", type: "number", defaultValue: 199 },
      ],
    },
    designSection("midnight"),
  ],
};

const Render: TemplateRender = ({ values, pageId, product, isPreview, bumpRuntime }) => {
  const timer: TimerConfig = {
    enabled: !!readField(values, "timer_enabled", false),
    target: readField(values, "timer_target", "") || undefined,
    label: readField(values, "timer_label", "") || undefined,
  };
  const orderBump: OrderBumpConfig = {
    enabled: !!readField(values, "bump_enabled", false),
    title: readField(values, "bump_title", "") || undefined,
    description: readField(values, "bump_description", "") || undefined,
    price: readField<number | undefined>(values, "bump_price", undefined),
  };
  return (
    <PaymentCoursePage
      pageId={pageId}
      product={product}
      isPreview={isPreview}
      bumpRuntime={bumpRuntime}
      timer={timer}
      orderBump={orderBump}
      socialProofEnabled={!!readField(values, "social_proof_enabled", false)}
      hero_eyebrow={readField(values, "hero_eyebrow", "")}
      hero_headline={readField(values, "hero_headline", "")}
      hero_subheadline={readField(values, "hero_subheadline", "")}
      hero_cta={readField(values, "hero_cta", "")}
      hero_image={readField(values, "hero_image", "")}
      benefits_title={readField(values, "benefits_title", "")}
      benefits_items={readField(values, "benefits_items", [])}
      instructor_name={readField(values, "instructor_name", "")}
      instructor_title={readField(values, "instructor_title", "")}
      instructor_bio={readField(values, "instructor_bio", "")}
      instructor_avatar={readField(values, "instructor_avatar", "")}
      testimonials_title={readField(values, "testimonials_title", "")}
      testimonials_items={readField(values, "testimonials_items", [])}
      faq_title={readField(values, "faq_title", "")}
      faq_items={readField(values, "faq_items", [])}
      checkout_title={readField(values, "checkout_title", "")}
      checkout_guarantee={readField(values, "checkout_guarantee", "")}
      theme_key={readField(values, "theme", "midnight")}
      bg_animation={readField(values, "bg_animation", "none")}
    />
  );
};

export const courseTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
