import type { ReactNode } from "react";
import { Check, Star } from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import type { FieldConfig } from "@/lib/templates/types";
import type { TgTheme } from "@/lib/telegram-themes";

// ── Block system for the "Build from scratch" template ──────────────────────
// Each block has: a field schema (edited with the standard FieldEditor), a
// default data object, and a themed Render. The custom page stores an ordered
// list of { id, type, data } in page_config.blocks.

export interface BlockContext {
  accent: string;
  theme: TgTheme;
  pageId?: string;
  slug?: string;
  isPreview?: boolean;
}

export interface BlockDef {
  type: string;
  label: string;
  fields: FieldConfig[];
  defaultData: Record<string, unknown>;
  Render: (data: Record<string, unknown>, ctx: BlockContext) => ReactNode;
}

const s = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const Section = ({ children }: { children: ReactNode }) => (
  <section className="mx-auto max-w-5xl px-4 py-12 md:py-16">{children}</section>
);

export const BLOCKS: Record<string, BlockDef> = {
  hero: {
    type: "hero",
    label: "Hero",
    defaultData: {
      eyebrow: "Introducing",
      headline: "A bold headline for your page",
      subheadline: "One clear sentence on the value you deliver.",
      cta_label: "Get started",
      image: "",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", defaultValue: "" },
      { key: "headline", label: "Headline", type: "text", defaultValue: "" },
      { key: "subheadline", label: "Subheadline", type: "textarea", defaultValue: "" },
      { key: "cta_label", label: "Button text", type: "text", defaultValue: "" },
      { key: "image", label: "Image URL (optional)", type: "image", defaultValue: "" },
    ],
    Render: (d, { accent }) => (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
        {s(d.eyebrow) && (
          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {s(d.eyebrow)}
          </p>
        )}
        <h1 className="mt-3 font-sora text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
          {s(d.headline)}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
          {s(d.subheadline)}
        </p>
        {s(d.image) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s(d.image)}
            alt=""
            className="mx-auto mt-8 w-full max-w-2xl rounded-2xl ring-1 ring-white/10"
          />
        )}
        {s(d.cta_label) && (
          <a
            href="#cta"
            className="btn-shine mt-8 inline-flex rounded-xl px-8 py-4 text-base font-semibold text-white shadow-lg"
            style={{ backgroundColor: accent }}
          >
            {s(d.cta_label)}
          </a>
        )}
      </section>
    ),
  },

  features: {
    type: "features",
    label: "Features",
    defaultData: {
      title: "Everything you need",
      items: [
        { title: "Fast", text: "Up and running in minutes." },
        { title: "Simple", text: "No clutter, just what matters." },
        { title: "Reliable", text: "Built to keep working." },
      ],
    },
    fields: [
      { key: "title", label: "Section title", type: "text", defaultValue: "" },
      {
        key: "items",
        label: "Features",
        type: "list",
        itemLabel: "feature",
        itemFields: [
          { key: "title", label: "Title", type: "text", defaultValue: "" },
          { key: "text", label: "Text", type: "textarea", defaultValue: "" },
        ],
        defaultValue: [],
      },
    ],
    Render: (d, { accent }) => {
      const items = arr<{ title?: string; text?: string }>(d.items);
      return (
        <Section>
          {s(d.title) && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <span
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: `${accent}26`, color: accent }}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <p className="font-sora text-sm font-semibold text-white">
                  {s(it.title)}
                </p>
                {s(it.text) && (
                  <p className="mt-1 text-sm text-zinc-300">{s(it.text)}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      );
    },
  },

  testimonials: {
    type: "testimonials",
    label: "Testimonials",
    defaultData: {
      title: "Loved by customers",
      items: [
        { quote: "This changed everything for us.", author: "Alex", role: "Founder" },
      ],
    },
    fields: [
      { key: "title", label: "Section title", type: "text", defaultValue: "" },
      {
        key: "items",
        label: "Testimonials",
        type: "list",
        itemLabel: "testimonial",
        itemFields: [
          { key: "quote", label: "Quote", type: "textarea", defaultValue: "" },
          { key: "author", label: "Author", type: "text", defaultValue: "" },
          { key: "role", label: "Role", type: "text", defaultValue: "" },
        ],
        defaultValue: [],
      },
    ],
    Render: (d, { accent }) => {
      const items = arr<{ quote?: string; author?: string; role?: string }>(d.items);
      return (
        <Section>
          {s(d.title) && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex gap-0.5" style={{ color: accent }}>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Star key={k} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm text-zinc-200">“{s(it.quote)}”</p>
                <p className="mt-3 text-sm font-semibold text-white">
                  {s(it.author)}
                  {s(it.role) && (
                    <span className="font-normal text-zinc-400"> · {s(it.role)}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Section>
      );
    },
  },

  faq: {
    type: "faq",
    label: "FAQ",
    defaultData: {
      title: "Questions & answers",
      items: [{ q: "Is there a guarantee?", a: "Yes — reach out any time." }],
    },
    fields: [
      { key: "title", label: "Section title", type: "text", defaultValue: "" },
      {
        key: "items",
        label: "Questions",
        type: "list",
        itemLabel: "question",
        itemFields: [
          { key: "q", label: "Question", type: "text", defaultValue: "" },
          { key: "a", label: "Answer", type: "textarea", defaultValue: "" },
        ],
        defaultValue: [],
      },
    ],
    Render: (d) => {
      const items = arr<{ q?: string; a?: string }>(d.items);
      return (
        <Section>
          {s(d.title) && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <p className="font-sora text-sm font-semibold text-white">
                  {s(it.q)}
                </p>
                {s(it.a) && (
                  <p className="mt-1.5 text-sm text-zinc-300">{s(it.a)}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      );
    },
  },

  cta: {
    type: "cta",
    label: "Call to action / signup",
    defaultData: {
      title: "Ready to start?",
      subtitle: "Drop your email and we'll be in touch.",
      cta_label: "Sign me up",
    },
    fields: [
      { key: "title", label: "Title", type: "text", defaultValue: "" },
      { key: "subtitle", label: "Subtitle", type: "textarea", defaultValue: "" },
      { key: "cta_label", label: "Button text", type: "text", defaultValue: "" },
    ],
    Render: (d, { accent, pageId }) => (
      <section id="cta" className="scroll-mt-8 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-md text-center">
          {s(d.title) && (
            <h2 className="font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          {s(d.subtitle) && (
            <p className="mt-2 text-zinc-300">{s(d.subtitle)}</p>
          )}
          <div className="mt-6 rounded-2xl bg-white p-6 text-left text-zinc-900 shadow-2xl">
            <LeadCaptureForm
              pageId={pageId ?? "preview"}
              ctaLabel={s(d.cta_label, "Submit")}
              primaryColor={accent}
            />
          </div>
        </div>
      </section>
    ),
  },
};

export const BLOCK_LIST = Object.values(BLOCKS);
