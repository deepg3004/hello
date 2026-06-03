// Telegram VIP — definition + adapter.

import { TelegramVipPage } from "@/components/templates/TelegramVipPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "telegram-vip",
  name: "Telegram VIP Access",
  description: "Paid join page for a Telegram VIP group or channel.",
  category: "telegram",
  dbType: "payment",
  thumbnail: "/templates/telegram-vip.svg",
  theme: { name: "Telegram Blue", primary: "#0088cc", background: "#0f172a" },
  sections: [
    {
      id: "preview",
      label: "Group preview",
      type: "preview",
      fields: [
        { key: "group_name", label: "Group name", type: "text", defaultValue: "Founders Inner Circle" },
        { key: "group_avatar", label: "Group avatar URL", type: "image", defaultValue: "" },
        { key: "members_label", label: "Members line", type: "text", defaultValue: "1,284 paying members" },
        { key: "category", label: "Category badge", type: "text", defaultValue: "Telegram", hint: "Small label shown next to the group name." },
        {
          key: "what_shared",
          label: "What gets shared (one item per line)",
          type: "textarea",
          defaultValue:
            "Live deal flow · Off-market intros · Weekly market notes · Members-only AMAs",
        },
      ],
    },
    {
      id: "benefits",
      label: "Benefits",
      type: "benefits",
      fields: [
        { key: "benefits_title", label: "Section title", type: "text", defaultValue: "Why join" },
        { key: "description", label: "Extra description (optional)", type: "textarea", defaultValue: "", hint: "One feature per line. Used to fill the list when no Benefits are added above." },
        {
          key: "benefits_items",
          label: "Benefits",
          type: "list",
          itemLabel: "benefit",
          itemFields: [{ key: "text", label: "Text", type: "text", defaultValue: "" }],
          defaultValue: [
            { text: "Direct access to a moderated room of serious founders" },
            { text: "Daily signal, not endless noise — every post is curated" },
            { text: "Weekly office hours with the host" },
          ],
        },
      ],
    },
    {
      id: "join",
      label: "Join card",
      type: "checkout",
      fields: [
        { key: "join_title", label: "Section title", type: "text", defaultValue: "Join the group" },
        { key: "join_note", label: "Card note", type: "text", defaultValue: "Invite link sent to your email after payment." },
        { key: "offer_ends_at", label: "Offer ends (optional)", type: "text", defaultValue: "", hint: "Limited-time countdown. ISO date, e.g. 2026-12-31T23:59. Leave blank for none." },
      ],
    },
    designSection("purple"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <TelegramVipPage
    pageId={pageId}
    slug={slug}
    product={product}
    products={products}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    group_name={readField(values, "group_name", "")}
    group_avatar={readField(values, "group_avatar", "")}
    members_label={readField(values, "members_label", "")}
    what_shared={readField(values, "what_shared", "")}
    benefits_title={readField(values, "benefits_title", "")}
    benefits_items={readField(values, "benefits_items", [])}
    join_title={readField(values, "join_title", "")}
    join_note={readField(values, "join_note", "")}
    description={readField(values, "description", "")}
    category={readField(values, "category", "")}
    offer_ends_at={readField(values, "offer_ends_at", null)}
    theme_key={readField(values, "theme", "purple")}
    bg_animation={readField(values, "bg_animation", "none")}
  />
);

export const telegramVipTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
