// eBook / Guide / PDF sales page — definition + adapter to the polished component.

import { EbookPage } from "@/components/templates/EbookPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "ebook",
  name: "eBook Sales Page",
  description: "Premium black & gold sales page for a paid eBook, guide or PDF.",
  category: "payment",
  dbType: "payment",
  thumbnail: "",
  theme: { name: "Black & Gold", primary: "#d4af37", background: "#0a0a0a" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow text", type: "text", defaultValue: "Digital eBook" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The Freelancer's Playbook — land high-paying clients on repeat",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A no-fluff, 120-page guide that walks you from zero to a fully-booked freelance business — with the exact scripts, templates and systems I use.",
        },
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Get the eBook" },
        {
          key: "hero_meta",
          label: "CTA sub-line",
          type: "text",
          defaultValue: "Instant PDF download · 120 pages · Read on any device",
        },
        { key: "hero_image", label: "Book cover image URL", type: "image", defaultValue: "" },
        {
          key: "book_label",
          label: "Cover label (shown on CSS book)",
          type: "text",
          defaultValue: "EBOOK",
          hint: "e.g. EBOOK, GUIDE, PDF — used only when no cover image is set.",
        },
      ],
    },
    {
      id: "chapters",
      label: "What's inside",
      type: "benefits",
      fields: [
        { key: "chapters_title", label: "Section title", type: "text", defaultValue: "What's inside" },
        {
          key: "chapters_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Every chapter is a self-contained playbook you can put to work the same day.",
        },
        {
          key: "chapters_items",
          label: "Chapters",
          type: "list",
          itemLabel: "chapter",
          minItems: 1,
          maxItems: 20,
          itemFields: [
            { key: "title", label: "Chapter title", type: "text", defaultValue: "" },
            { key: "description", label: "Short description", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            { title: "Positioning that sells", description: "Carve out a niche clients fight to pay for." },
            { title: "Irresistible offers", description: "Package your work so the price never gets questioned." },
            { title: "The outreach system", description: "Copy-paste scripts that book calls without feeling spammy." },
            { title: "Closing the deal", description: "Handle objections and sign clients with confidence." },
            { title: "Pricing for profit", description: "Raise your rates without losing a single client." },
            { title: "Delivery on autopilot", description: "Templates and SOPs so projects run themselves." },
          ],
        },
      ],
    },
    {
      id: "author",
      label: "About the author",
      type: "instructor",
      fields: [
        { key: "author_eyebrow", label: "Eyebrow", type: "text", defaultValue: "About the author" },
        { key: "author_name", label: "Name", type: "text", defaultValue: "Your name" },
        { key: "author_title", label: "Title / credentials", type: "text", defaultValue: "Freelancer · 8 years · ₹2Cr+ in projects" },
        {
          key: "author_bio",
          label: "Short bio",
          type: "textarea",
          defaultValue:
            "I built a six-figure freelance business from my bedroom and have since helped 3,000+ freelancers do the same. This eBook is the exact system, written down.",
        },
        { key: "author_avatar", label: "Avatar image URL", type: "image", defaultValue: "" },
      ],
    },
    {
      id: "testimonials",
      label: "Testimonials",
      type: "testimonials",
      fields: [
        { key: "testimonials_title", label: "Section title", type: "text", defaultValue: "Readers love it" },
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
              quote: "I made back the price of this eBook in a single client call. Worth 10x what I paid.",
              author: "Priya S.",
              role: "Brand Designer",
            },
            {
              quote: "Finally a guide with real scripts and templates instead of vague advice. I devoured it in a weekend.",
              author: "Rahul K.",
              role: "Web Developer",
            },
            {
              quote: "Doubled my rates the week after reading chapter 5. No regrets.",
              author: "Anita M.",
              role: "Copywriter",
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
        { key: "checkout_subtitle", label: "Badge text", type: "text", defaultValue: "Instant download" },
        { key: "checkout_title", label: "Section title", type: "text", defaultValue: "Get instant access" },
        {
          key: "checkout_guarantee",
          label: "Guarantee line",
          type: "text",
          defaultValue: "7-day money-back guarantee. If it doesn't help, get a full refund.",
        },
      ],
    },
    designSection("gold"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <EbookPage
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
    hero_meta={readField(values, "hero_meta", "")}
    hero_image={readField(values, "hero_image", "")}
    book_label={readField(values, "book_label", "EBOOK")}
    chapters_title={readField(values, "chapters_title", "")}
    chapters_subtitle={readField(values, "chapters_subtitle", "")}
    chapters_items={readField(values, "chapters_items", [])}
    author_eyebrow={readField(values, "author_eyebrow", "")}
    author_name={readField(values, "author_name", "")}
    author_title={readField(values, "author_title", "")}
    author_bio={readField(values, "author_bio", "")}
    author_avatar={readField(values, "author_avatar", "")}
    testimonials_title={readField(values, "testimonials_title", "")}
    testimonials_items={readField(values, "testimonials_items", [])}
    checkout_subtitle={readField(values, "checkout_subtitle", "")}
    checkout_title={readField(values, "checkout_title", "")}
    checkout_guarantee={readField(values, "checkout_guarantee", "")}
    theme_key={readField(values, "theme", "gold")}
    bg_animation={readField(values, "bg_animation", "none")}
  />
);

export const ebookTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
