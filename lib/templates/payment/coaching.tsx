// Coaching / consulting page — charcoal + orange accent.

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { extractDefaults, readField } from "@/lib/templates/utils";
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
        {
          key: "urgency_enabled",
          label: "Show banner",
          type: "toggle",
          defaultValue: true,
        },
        {
          key: "urgency_text",
          label: "Banner text",
          type: "text",
          defaultValue: "Only 5 spots open this month",
        },
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
        {
          key: "hero_cta",
          label: "CTA button label",
          type: "text",
          defaultValue: "Book a strategy call",
        },
      ],
    },
    {
      id: "what_you_get",
      label: "What you get",
      type: "benefits",
      fields: [
        {
          key: "wyg_title",
          label: "Section title",
          type: "text",
          defaultValue: "Here's what you get",
        },
        {
          key: "wyg_items",
          label: "Deliverables",
          type: "list",
          itemLabel: "deliverable",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
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
        {
          key: "metric1_value",
          label: "Metric 1 value",
          type: "text",
          defaultValue: "120+",
        },
        {
          key: "metric1_label",
          label: "Metric 1 label",
          type: "text",
          defaultValue: "founders coached",
        },
        {
          key: "metric2_value",
          label: "Metric 2 value",
          type: "text",
          defaultValue: "10 yrs",
        },
        {
          key: "metric2_label",
          label: "Metric 2 label",
          type: "text",
          defaultValue: "as a founder + operator",
        },
        {
          key: "metric3_value",
          label: "Metric 3 value",
          type: "text",
          defaultValue: "$40M+",
        },
        {
          key: "metric3_label",
          label: "Metric 3 label",
          type: "text",
          defaultValue: "in revenue I've helped clients ship",
        },
      ],
    },
    {
      id: "who",
      label: "Who this is for",
      type: "audience",
      fields: [
        {
          key: "who_title",
          label: "Section title",
          type: "text",
          defaultValue: "Who this is for",
        },
        {
          key: "who_items",
          label: "Audience bullets",
          type: "list",
          itemLabel: "audience",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "First-time founders who want to skip the dumb mistakes" },
            { text: "Operators going indie for the first time" },
            { text: "Side-project builders ready to commit full-time" },
          ],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      fields: [
        {
          key: "checkout_title",
          label: "Section title",
          type: "text",
          defaultValue: "Reserve your spot",
        },
        {
          key: "checkout_note",
          label: "Note",
          type: "text",
          defaultValue: "Discovery call within 48h of booking.",
        },
      ],
    },
  ],
};

interface BulletItem { text: string }

const Render: TemplateRender = ({ values, pageId, product, isPreview }) => {
  const banner = readField(values, "urgency_enabled", true);
  const bannerText = readField(values, "urgency_text", "");
  const headline = readField(values, "hero_headline", "");
  const sub = readField(values, "hero_subheadline", "");
  const cta = readField(values, "hero_cta", "Book a strategy call");

  const wygTitle = readField(values, "wyg_title", "");
  const wyg = readField<BulletItem[]>(values, "wyg_items", []);

  const m1v = readField(values, "metric1_value", "");
  const m1l = readField(values, "metric1_label", "");
  const m2v = readField(values, "metric2_value", "");
  const m2l = readField(values, "metric2_label", "");
  const m3v = readField(values, "metric3_value", "");
  const m3l = readField(values, "metric3_label", "");

  const whoTitle = readField(values, "who_title", "");
  const who = readField<BulletItem[]>(values, "who_items", []);

  const checkoutTitle = readField(values, "checkout_title", "");
  const note = readField(values, "checkout_note", "");

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {banner && bannerText && (
        <div className="bg-orange-600 px-4 py-2 text-center text-sm font-medium">
          {bannerText}
        </div>
      )}

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {headline}
        </h1>
        {sub && (
          <p className="mt-5 text-lg leading-relaxed text-zinc-300">{sub}</p>
        )}
        <a
          href="#book"
          className="mt-8 inline-block rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-orange-400"
        >
          {cta}
        </a>
      </section>

      <section className="bg-zinc-800 py-12">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-6 text-center md:grid-cols-3">
          {[
            [m1v, m1l],
            [m2v, m2l],
            [m3v, m3l],
          ].map(([v, l], i) => (
            <div key={i}>
              <div className="text-3xl font-semibold text-orange-400">{v}</div>
              <div className="text-sm text-zinc-400">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {wyg.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{wygTitle}</h2>
            <ul className="mt-6 space-y-3">
              {wyg.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-2 inline-block h-1.5 w-3 shrink-0 rounded-sm bg-orange-500" />
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {who.length > 0 && (
        <section className="bg-zinc-800 py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{whoTitle}</h2>
            <ul className="mt-6 space-y-2">
              {who.map((b, i) => (
                <li key={i} className="rounded-md border border-white/5 bg-zinc-900 px-4 py-3 text-zinc-200">
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="book" className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{checkoutTitle}</h2>
          {note && (
            <p className="mt-2 text-center text-sm text-zinc-400">{note}</p>
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

export const coachingTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
