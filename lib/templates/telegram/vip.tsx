// Telegram VIP group join page.

import { CheckoutForm } from "@/components/pages/CheckoutForm";
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
        {
          key: "group_name",
          label: "Group name",
          type: "text",
          defaultValue: "Founders Inner Circle",
        },
        {
          key: "group_avatar",
          label: "Group avatar URL",
          type: "image",
          defaultValue: "",
        },
        {
          key: "members_label",
          label: "Members line",
          type: "text",
          defaultValue: "1,284 paying members",
        },
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
        {
          key: "benefits_title",
          label: "Section title",
          type: "text",
          defaultValue: "Why join",
        },
        {
          key: "benefits_items",
          label: "Benefits",
          type: "list",
          itemLabel: "benefit",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
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
        {
          key: "join_title",
          label: "Section title",
          type: "text",
          defaultValue: "Join the group",
        },
        {
          key: "join_note",
          label: "Card note",
          type: "text",
          defaultValue: "Invite link sent to your email after payment.",
        },
      ],
    },
  ],
};

interface BenefitItem { text: string }

const Render: TemplateRender = ({ values, pageId, product, isPreview }) => {
  const groupName = readField(values, "group_name", "");
  const groupAvatar = readField(values, "group_avatar", "");
  const membersLabel = readField(values, "members_label", "");
  const whatShared = readField(values, "what_shared", "");
  const benefitsTitle = readField(values, "benefits_title", "");
  const benefits = readField<BenefitItem[]>(values, "benefits_items", []);
  const joinTitle = readField(values, "join_title", "");
  const joinNote = readField(values, "join_note", "");

  const sharedItems = whatShared
    .split(/[•·\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100">
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-10 text-center">
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-[#0088cc] bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {groupAvatar ? (
            <img src={groupAvatar} alt={groupName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#0088cc]">
              {groupName?.[0] ?? "T"}
            </div>
          )}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">{groupName}</h1>
        {membersLabel && (
          <p className="mt-1 text-sm text-[#0088cc]">{membersLabel}</p>
        )}
        {sharedItems.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {sharedItems.map((s, i) => (
              <span
                key={i}
                className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-zinc-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </section>

      {benefits.length > 0 && (
        <section className="border-t border-white/5 py-12">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{benefitsTitle}</h2>
            <ul className="mt-6 space-y-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#0088cc]" />
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="join" className="border-t border-white/5 bg-slate-900 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{joinTitle}</h2>
          {joinNote && (
            <p className="mt-2 text-center text-sm text-zinc-400">{joinNote}</p>
          )}
          <div className="mt-8 rounded-xl bg-white p-6 text-zinc-900">
            {pageId && product && !isPreview ? (
              <CheckoutForm
                pageId={pageId}
                productId={product.id}
                productName={product.name}
                productDescription={product.description}
                productImage={product.image_url}
                price={Number(product.price)}
                currency={product.currency}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                {isPreview
                  ? "Checkout form renders on the live page."
                  : "Attach a product to this page to enable checkout."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export const telegramVipTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
