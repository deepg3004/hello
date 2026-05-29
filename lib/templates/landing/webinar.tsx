// Webinar registration page.

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "webinar",
  name: "Webinar Registration",
  description: "Live-or-replay webinar opt-in with date banner and host bio.",
  category: "landing",
  dbType: "landing",
  thumbnail: "/templates/webinar.svg",
  theme: { name: "Indigo + Cyan", primary: "#6366f1", background: "#0b0b14" },
  sections: [
    {
      id: "banner",
      label: "Date / time banner",
      type: "banner",
      fields: [
        {
          key: "banner_text",
          label: "Banner text",
          type: "text",
          defaultValue: "Live · Thursday 7 Jun, 7:00 PM IST",
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
          label: "Headline",
          type: "text",
          defaultValue: "How to ship your SaaS in 90 days (without burning out)",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A 60-minute live session with Q&A. Replay sent to everyone who registers.",
        },
      ],
    },
    {
      id: "host",
      label: "Host",
      type: "instructor",
      fields: [
        { key: "host_name", label: "Host name", type: "text", defaultValue: "Your name" },
        {
          key: "host_title",
          label: "Host title",
          type: "text",
          defaultValue: "Founder · 7-figure SaaS",
        },
        {
          key: "host_bio",
          label: "Host bio",
          type: "textarea",
          defaultValue:
            "I've launched 14 products. This is the framework I now use for every new one.",
        },
        { key: "host_avatar", label: "Host avatar URL", type: "image", defaultValue: "" },
      ],
    },
    {
      id: "agenda",
      label: "What you'll learn",
      type: "benefits",
      fields: [
        {
          key: "agenda_title",
          label: "Section title",
          type: "text",
          defaultValue: "What you'll learn",
        },
        {
          key: "agenda_items",
          label: "Bullets",
          type: "list",
          itemLabel: "lesson",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "The 4-stage ship-it framework I use for every product" },
            { text: "How to validate ideas in 48 hours" },
            { text: "The exact tools, ad scripts, and pricing model that work today" },
          ],
        },
      ],
    },
    {
      id: "register",
      label: "Registration form",
      type: "form",
      fields: [
        {
          key: "register_title",
          label: "Section title",
          type: "text",
          defaultValue: "Reserve your seat",
        },
        {
          key: "register_cta",
          label: "Button label",
          type: "text",
          defaultValue: "Register free",
        },
        {
          key: "register_count_label",
          label: "Social proof line",
          type: "text",
          defaultValue: "1,247 founders already registered",
        },
      ],
    },
  ],
};

interface AgendaItem { text: string }

const Render: TemplateRender = ({ values, pageId, isPreview }) => {
  const banner = readField(values, "banner_text", "");
  const headline = readField(values, "hero_headline", "");
  const sub = readField(values, "hero_subheadline", "");
  const hostName = readField(values, "host_name", "");
  const hostTitle = readField(values, "host_title", "");
  const hostBio = readField(values, "host_bio", "");
  const hostAvatar = readField(values, "host_avatar", "");
  const agendaTitle = readField(values, "agenda_title", "");
  const agenda = readField<AgendaItem[]>(values, "agenda_items", []);
  const regTitle = readField(values, "register_title", "");
  const regCta = readField(values, "register_cta", "Register free");
  const regCount = readField(values, "register_count_label", "");

  return (
    <div className="min-h-screen bg-[#0b0b14] text-zinc-100">
      {banner && (
        <div className="bg-indigo-600 px-4 py-2 text-center text-sm font-medium">
          {banner}
        </div>
      )}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {headline}
        </h1>
        {sub && (
          <p className="mt-5 text-lg leading-relaxed text-zinc-300">{sub}</p>
        )}
      </section>

      {(hostName || hostBio) && (
        <section className="border-t border-white/5 py-12">
          <div className="mx-auto flex max-w-3xl items-center gap-5 px-6">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {hostAvatar ? (
                <img src={hostAvatar} alt={hostName} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-indigo-300">Hosted by</p>
              <div className="font-medium">{hostName}</div>
              <div className="text-sm text-zinc-400">{hostTitle}</div>
              <p className="mt-2 text-sm text-zinc-300">{hostBio}</p>
            </div>
          </div>
        </section>
      )}

      {agenda.length > 0 && (
        <section className="border-t border-white/5 bg-[#10101c] py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{agendaTitle}</h2>
            <ul className="mt-6 space-y-3">
              {agenda.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-5 w-5 shrink-0 rounded-full bg-indigo-500/20 text-center text-xs font-semibold leading-5 text-indigo-300">
                    {i + 1}
                  </span>
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="register" className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-md px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{regTitle}</h2>
          {regCount && (
            <p className="mt-2 text-center text-sm text-zinc-400">{regCount}</p>
          )}
          <div className="mt-6 rounded-xl bg-white p-6 text-zinc-900">
            {pageId && !isPreview ? (
              <LeadCaptureForm pageId={pageId} ctaLabel={regCta} requirePhone />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                Registration form renders on the live page.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export const webinarTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
