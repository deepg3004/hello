// Lead magnet / freebie download page.

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "freebie",
  name: "Free Download (Lead Magnet)",
  description: "Email opt-in page for a free download — checklists, ebooks, swipe files.",
  category: "lead_magnet",
  dbType: "lead_magnet",
  thumbnail: "/templates/freebie.svg",
  theme: { name: "Cream + Coral", primary: "#fb7185", background: "#fff7ed" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "badge_text",
          label: "Badge text",
          type: "text",
          defaultValue: "Free Download",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The 25-question cold-outreach swipe file",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Battle-tested email questions that booked 312 sales calls last quarter.",
        },
      ],
    },
    {
      id: "inside",
      label: "What's inside",
      type: "benefits",
      fields: [
        {
          key: "inside_title",
          label: "Section title",
          type: "text",
          defaultValue: "What's inside",
        },
        {
          key: "inside_items",
          label: "Bullets",
          type: "list",
          itemLabel: "bullet",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "25 cold-outreach questions categorized by intent" },
            { text: "5 follow-up sequences you can copy-paste" },
            { text: "A scoring rubric so you stop wasting reps on dead leads" },
          ],
        },
      ],
    },
    {
      id: "optin",
      label: "Opt-in form",
      type: "form",
      fields: [
        {
          key: "optin_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Send me the swipe file",
        },
        {
          key: "optin_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "We'll never spam you. Unsubscribe in one click.",
        },
      ],
    },
  ],
};

interface BulletItem { text: string }

const Render: TemplateRender = ({ values, pageId, isPreview }) => {
  const badge = readField(values, "badge_text", "Free Download");
  const headline = readField(values, "hero_headline", "");
  const sub = readField(values, "hero_subheadline", "");
  const insideTitle = readField(values, "inside_title", "");
  const inside = readField<BulletItem[]>(values, "inside_items", []);
  const cta = readField(values, "optin_cta", "Send it to me");
  const privacy = readField(values, "optin_privacy", "");

  return (
    <div className="min-h-screen bg-[#fff7ed] text-zinc-900">
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        {badge && (
          <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rose-600">
            {badge}
          </span>
        )}
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {headline}
        </h1>
        {sub && (
          <p className="mt-5 text-lg leading-relaxed text-zinc-600">{sub}</p>
        )}
      </section>

      {inside.length > 0 && (
        <section className="border-y border-rose-100 bg-white py-12">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-xl font-semibold tracking-tight">{insideTitle}</h2>
            <ul className="mt-5 space-y-3">
              {inside.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-600">
                    ✓
                  </span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="mx-auto max-w-md px-6">
          <div className="rounded-xl border border-rose-100 bg-white p-6 shadow-sm">
            {pageId && !isPreview ? (
              <LeadCaptureForm pageId={pageId} ctaLabel={cta} requirePhone={false} />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                Opt-in form renders on the live page.
              </p>
            )}
          </div>
          {privacy && (
            <p className="mt-4 text-center text-xs text-zinc-500">{privacy}</p>
          )}
        </div>
      </section>
    </div>
  );
};

export const freebieTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
