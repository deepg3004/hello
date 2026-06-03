// Membership / community-access page — definition + adapter to the component.

import { MembershipPage } from "@/components/templates/MembershipPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "membership",
  name: "Membership Page",
  description: "Premium members-only access page for a paid community or membership.",
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
        { key: "hero_badge", label: "Badge text", type: "text", defaultValue: "Members only" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Join the inner circle and get access you can't get anywhere else",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A private membership for people who want exclusive content, direct access, and a community that actually shows up.",
        },
        { key: "hero_cta", label: "CTA button label", type: "text", defaultValue: "Become a member" },
        { key: "hero_image", label: "Hero image URL", type: "image", defaultValue: "" },
      ],
    },
    {
      id: "perks",
      label: "What members get",
      type: "benefits",
      fields: [
        { key: "perks_title", label: "Section title", type: "text", defaultValue: "What members get" },
        {
          key: "perks_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Everything inside the membership, included from day one.",
        },
        {
          key: "perks_items",
          label: "Perks",
          type: "list",
          itemLabel: "perk",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "text", label: "Perk", type: "text", defaultValue: "" },
            { key: "description", label: "Short description", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "Private member community", description: "A focused space to connect, ask, and share wins." },
            { text: "Weekly exclusive content", description: "Drops only members ever see." },
            { text: "Direct access in Q&A sessions", description: "Bring your questions and get real answers." },
            { text: "Full resource library", description: "Templates, guides, and recordings, all in one place." },
            { text: "Member-only perks & discounts", description: "Partner deals reserved for the circle." },
            { text: "Cancel anytime", description: "No lock-in. Stay because it's worth it." },
          ],
        },
      ],
    },
    {
      id: "whofor",
      label: "Who it's for",
      type: "benefits",
      fields: [
        { key: "whofor_label", label: "Label", type: "text", defaultValue: "Who it's for" },
        {
          key: "whofor_text",
          label: "Who it's for line",
          type: "textarea",
          defaultValue:
            "Perfect for creators, builders, and learners who want a serious community and ongoing access — not another one-off course.",
        },
      ],
    },
    {
      id: "proof",
      label: "Member social proof",
      type: "testimonials",
      fields: [
        { key: "member_count_label", label: "Member count line", type: "text", defaultValue: "Trusted by 1,800+ members" },
        { key: "proof_title", label: "Section title", type: "text", defaultValue: "What members say" },
        {
          key: "testimonials_items",
          label: "Member testimonials",
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
              quote: "Easily the best money I spend each month. The community alone is worth it.",
              author: "Maya R.",
              role: "Member since 2024",
            },
            {
              quote: "The weekly drops and Q&A sessions keep me consistent in a way nothing else has.",
              author: "Dev P.",
              role: "Founding member",
            },
            {
              quote: "It feels like having a team in my corner. I never want to cancel.",
              author: "Sara L.",
              role: "Member",
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
        { key: "checkout_title", label: "Section title", type: "text", defaultValue: "Join today" },
        {
          key: "checkout_billing_note",
          label: "Billing note (next to price)",
          type: "text",
          defaultValue: "/ month",
          hint: 'e.g. "/ month", "/ year", or "one-time".',
        },
        { key: "checkout_features_title", label: "Features list title", type: "text", defaultValue: "Your membership includes" },
        {
          key: "checkout_features",
          label: "Checkout features",
          type: "list",
          itemLabel: "feature",
          minItems: 0,
          maxItems: 8,
          itemFields: [{ key: "text", label: "Feature", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "Instant access to the member area" },
            { text: "All exclusive content + recordings" },
            { text: "Member community access" },
            { text: "Cancel anytime, no questions" },
          ],
        },
        {
          key: "checkout_guarantee",
          label: "Guarantee line",
          type: "text",
          defaultValue: "Cancel anytime. 7-day money-back guarantee on your first payment.",
        },
      ],
    },
    designSection("midnight"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <MembershipPage
    pageId={pageId}
    slug={slug}
    product={product}
    products={products}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    hero_badge={readField(values, "hero_badge", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_cta={readField(values, "hero_cta", "")}
    hero_image={readField(values, "hero_image", "")}
    perks_title={readField(values, "perks_title", "")}
    perks_subtitle={readField(values, "perks_subtitle", "")}
    perks_items={readField(values, "perks_items", [])}
    whofor_label={readField(values, "whofor_label", "")}
    whofor_text={readField(values, "whofor_text", "")}
    proof_title={readField(values, "proof_title", "")}
    member_count_label={readField(values, "member_count_label", "")}
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

export const membershipTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
