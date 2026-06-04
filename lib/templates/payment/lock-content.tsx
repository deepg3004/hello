// "Lock Content" — sell access to gated content (notes, links, resources) behind
// a one-time payment. The public page shows only a teaser + checkout; the actual
// content lives in page_config.locked_* and is served by /unlock/[pageId] after
// payment (never rendered on the public sales page). dbType: payment, so it
// reuses the full checkout → order → wallet-fee flow.

import { LockContentPage } from "@/components/templates/LockContentPage";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type {
  Template,
  TemplateDefinition,
  TemplateRender,
} from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "lock-content",
  name: "Lock Content",
  description:
    "Hide notes, links or resources behind a one-time payment. Buyers unlock a private page the moment they pay.",
  category: "payment",
  dbType: "payment",
  thumbnail: "",
  theme: { name: "Violet", primary: "#7C3AED", background: "#0a0a0a" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      category: "landing",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow", type: "text", defaultValue: "Locked content" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Unlock the full resource",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Everything you need in one place — revealed instantly after payment.",
        },
        { key: "hero_image", label: "Cover image URL", type: "image", defaultValue: "" },
        {
          key: "accent_color",
          label: "Accent colour",
          type: "color",
          defaultValue: "#7C3AED",
        },
      ],
    },
    {
      id: "unlock",
      label: "What you'll unlock",
      type: "benefits",
      category: "landing",
      fields: [
        {
          key: "unlock_title",
          label: "Section title",
          type: "text",
          defaultValue: "What you'll get",
        },
        {
          key: "unlock_items",
          label: "Teaser items (shown BEFORE payment)",
          type: "list",
          itemLabel: "item",
          minItems: 0,
          maxItems: 12,
          itemFields: [
            { key: "title", label: "Title", type: "text", defaultValue: "" },
            { key: "description", label: "Short description", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            { title: "The full resource pack", description: "All the links and files in one place." },
            { title: "Lifetime access", description: "Come back any time with your unlock link." },
          ],
        },
      ],
    },
    {
      id: "locked",
      label: "🔒 Locked content (shown only AFTER payment)",
      type: "content",
      category: "landing",
      fields: [
        {
          key: "locked_intro",
          label: "Intro message",
          type: "textarea",
          defaultValue: "Thanks for your purchase! Here's everything you unlocked:",
        },
        {
          key: "locked_body",
          label: "Body text",
          type: "textarea",
          defaultValue: "",
          hint: "Plain text. Line breaks are preserved. This is hidden until the buyer pays.",
        },
        {
          key: "locked_links",
          label: "Unlockable links / downloads",
          type: "list",
          itemLabel: "link",
          minItems: 0,
          maxItems: 50,
          itemFields: [
            { key: "label", label: "Label", type: "text", defaultValue: "" },
            { key: "url", label: "URL", type: "text", defaultValue: "" },
            { key: "note", label: "Note (optional)", type: "text", defaultValue: "" },
          ],
          defaultValue: [],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      category: "payment",
      fields: [
        {
          key: "checkout_title",
          label: "Checkout heading",
          type: "text",
          defaultValue: "Pay once to unlock instantly",
        },
        {
          key: "checkout_guarantee",
          label: "Guarantee line",
          type: "text",
          defaultValue: "Instant access. Secure payment.",
        },
      ],
    },
  ],
};

const Render: TemplateRender = ({
  values,
  pageId,
  slug,
  product,
  isPreview,
  bumpRuntime,
}) => (
  <LockContentPage
    pageId={pageId}
    slug={slug}
    product={product}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    accent={readField(values, "accent_color", "#7C3AED")}
    hero_eyebrow={readField(values, "hero_eyebrow", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_image={readField(values, "hero_image", "")}
    unlock_title={readField(values, "unlock_title", "")}
    unlock_items={readField(values, "unlock_items", [])}
    checkout_title={readField(values, "checkout_title", "")}
    checkout_guarantee={readField(values, "checkout_guarantee", "")}
  />
);

export const lockContentTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
