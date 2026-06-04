import type { ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  Star,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  Send,
  Globe,
} from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { Carousel } from "@/components/templates/blocks/Carousel";
import { formatINR } from "@/lib/utils";
import type { FieldConfig } from "@/lib/templates/types";
import type { TgTheme } from "@/lib/telegram-themes";

// ── Block system ────────────────────────────────────────────────────────────
// Each block has: a field schema (edited with the standard FieldEditor), a
// default data object, and a themed Render. Used by the "Build from scratch"
// page template AND the seller website builder (site_pages.blocks). Both store
// an ordered list of { id, type, data }.

export interface SiteProductLite {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number; // rupees
  original_price: number | null;
  is_popular?: boolean;
  slug: string;
}

export interface BlockContext {
  accent: string;
  /** Legacy dark theme (custom-template pages). Website pages theme via CSS
   *  variables on the wrapper instead, so this is optional. */
  theme?: TgTheme;
  pageId?: string;
  slug?: string;
  isPreview?: boolean;
  /** Seller's live products — fed to the "products" block on website pages. */
  products?: SiteProductLite[];
  /** Seller identity — used by the "about" block defaults. */
  seller?: { name: string; avatar: string | null };
  /** Social handles/URLs — used by the "social" block. */
  socialLinks?: Record<string, string> | null;
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
        <h1 className="mt-3 font-sora text-4xl font-extrabold leading-tight tracking-tight text-[color:var(--s-fg)] sm:text-5xl">
          {s(d.headline)}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[color:var(--s-fg-muted)]">
          {s(d.subheadline)}
        </p>
        {s(d.image) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s(d.image)}
            alt=""
            className="mx-auto mt-8 w-full max-w-2xl rounded-2xl ring-1 ring-[color:var(--s-border)]"
          />
        )}
        {s(d.cta_label) && (
          <a
            href="#cta"
            className="btn-shine mt-8 inline-flex rounded-xl px-8 py-4 text-base font-semibold text-[color:var(--s-fg)] shadow-lg"
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
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-[color:var(--s-border)] bg-[var(--s-surface)] p-5"
              >
                <span
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--s-fg)]"
                  style={{ backgroundColor: `${accent}26`, color: accent }}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <p className="font-sora text-sm font-semibold text-[color:var(--s-fg)]">
                  {s(it.title)}
                </p>
                {s(it.text) && (
                  <p className="mt-1 text-sm text-[color:var(--s-fg-muted)]">{s(it.text)}</p>
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
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-[color:var(--s-border)] bg-[var(--s-surface)] p-5"
              >
                <div className="flex gap-0.5" style={{ color: accent }}>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Star key={k} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm text-[color:var(--s-fg-muted)]">“{s(it.quote)}”</p>
                <p className="mt-3 text-sm font-semibold text-[color:var(--s-fg)]">
                  {s(it.author)}
                  {s(it.role) && (
                    <span className="font-normal text-[color:var(--s-fg-dim)]"> · {s(it.role)}</span>
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
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-[color:var(--s-border)] bg-[var(--s-surface)] p-4"
              >
                <p className="font-sora text-sm font-semibold text-[color:var(--s-fg)]">
                  {s(it.q)}
                </p>
                {s(it.a) && (
                  <p className="mt-1.5 text-sm text-[color:var(--s-fg-muted)]">{s(it.a)}</p>
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
            <h2 className="font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          {s(d.subtitle) && (
            <p className="mt-2 text-[color:var(--s-fg-muted)]">{s(d.subtitle)}</p>
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

  about: {
    type: "about",
    label: "About / Bio",
    defaultData: {
      heading: "About me",
      body: "Tell visitors who you are and what you do.",
      image: "",
    },
    fields: [
      { key: "heading", label: "Heading", type: "text", defaultValue: "" },
      { key: "body", label: "Bio", type: "textarea", defaultValue: "" },
      { key: "image", label: "Photo URL (optional)", type: "image", defaultValue: "" },
    ],
    Render: (d, { seller }) => {
      const img = s(d.image) || seller?.avatar || "";
      return (
        <Section>
          <div className="grid items-center gap-8 md:grid-cols-2">
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt=""
                className="mx-auto w-full max-w-sm rounded-2xl object-cover ring-1 ring-[color:var(--s-border)]"
              />
            )}
            <div className={img ? "" : "md:col-span-2 mx-auto max-w-2xl text-center"}>
              {s(d.heading) && (
                <h2 className="font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
                  {s(d.heading)}
                </h2>
              )}
              {s(d.body) && (
                <p className="mt-4 whitespace-pre-line text-[color:var(--s-fg-muted)]">{s(d.body)}</p>
              )}
            </div>
          </div>
        </Section>
      );
    },
  },

  products: {
    type: "products",
    label: "Products / Store",
    defaultData: { title: "What I offer" },
    fields: [
      { key: "title", label: "Section title", type: "text", defaultValue: "" },
    ],
    Render: (d, { accent, products }) => {
      const list = products ?? [];
      if (list.length === 0) {
        return (
          <Section>
            {s(d.title) && (
              <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
                {s(d.title)}
              </h2>
            )}
            <p className="mt-6 text-center text-sm text-[color:var(--s-fg-dim)]">
              Your live products will appear here.
            </p>
          </Section>
        );
      }
      return (
        <Section>
          {s(d.title) && (
            <h2 className="mb-8 text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Link
                key={p.id}
                href={`/${p.slug}`}
                className="group block overflow-hidden rounded-xl border border-[color:var(--s-border)] bg-[var(--s-surface)] transition hover:border-[color:var(--s-fg-dim)]"
              >
                <div className="relative aspect-[16/9] w-full bg-[var(--s-surface)]">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-white/10 to-white/0" />
                  )}
                  {p.is_popular && (
                    <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-900">
                      Popular
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-sora font-semibold tracking-tight text-[color:var(--s-fg)]">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[color:var(--s-fg-dim)]">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-bold" style={{ color: accent }}>
                      {formatINR(Math.round(p.price * 100))}
                    </span>
                    {p.original_price && p.original_price > p.price && (
                      <span className="text-sm text-[color:var(--s-fg-dim)] line-through">
                        {formatINR(Math.round(p.original_price * 100))}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      );
    },
  },

  social: {
    type: "social",
    label: "Social links",
    defaultData: { title: "Find me online" },
    fields: [
      { key: "title", label: "Section title", type: "text", defaultValue: "" },
    ],
    Render: (d, { accent, socialLinks }) => {
      const links = socialLinks ?? {};
      const ICONS: Record<string, typeof Globe> = {
        instagram: Instagram,
        youtube: Youtube,
        twitter: Twitter,
        linkedin: Linkedin,
        telegram: Send,
        website: Globe,
      };
      const entries = Object.entries(links).filter(([, v]) => !!v);
      if (entries.length === 0) return null;
      return (
        <Section>
          {s(d.title) && (
            <h2 className="mb-6 text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {entries.map(([k, url]) => {
              const Icon = ICONS[k] ?? Globe;
              const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
              return (
                <a
                  key={k}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--s-border)] bg-[var(--s-surface)] text-[color:var(--s-fg)] transition hover:scale-110"
                  style={{ color: accent }}
                  aria-label={k}
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        </Section>
      );
    },
  },

  richtext: {
    type: "richtext",
    label: "Text block",
    defaultData: { heading: "", body: "Write anything you like here." },
    fields: [
      { key: "heading", label: "Heading (optional)", type: "text", defaultValue: "" },
      { key: "body", label: "Text", type: "textarea", defaultValue: "" },
    ],
    Render: (d) => (
      <Section>
        <div className="mx-auto max-w-2xl">
          {s(d.heading) && (
            <h2 className="font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.heading)}
            </h2>
          )}
          {s(d.body) && (
            <p className="mt-4 whitespace-pre-line text-[color:var(--s-fg-muted)]">{s(d.body)}</p>
          )}
        </div>
      </Section>
    ),
  },

  gallery: {
    type: "gallery",
    label: "Image gallery",
    defaultData: { title: "Gallery", items: [] },
    fields: [
      { key: "title", label: "Section title", type: "text", defaultValue: "" },
      {
        key: "items",
        label: "Images",
        type: "list",
        itemLabel: "image",
        itemFields: [
          { key: "image", label: "Image URL", type: "image", defaultValue: "" },
          { key: "caption", label: "Caption (optional)", type: "text", defaultValue: "" },
        ],
        defaultValue: [],
      },
    ],
    Render: (d) => {
      const items = arr<{ image?: string; caption?: string }>(d.items).filter((i) => s(i.image));
      if (items.length === 0) return null;
      return (
        <Section>
          {s(d.title) && (
            <h2 className="mb-8 text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <figure key={i} className="overflow-hidden rounded-xl border border-[color:var(--s-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s(it.image)} alt={s(it.caption)} className="aspect-square w-full object-cover" />
                {s(it.caption) && (
                  <figcaption className="bg-[var(--s-surface)] px-3 py-2 text-xs text-[color:var(--s-fg-muted)]">
                    {s(it.caption)}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </Section>
      );
    },
  },

  video: {
    type: "video",
    label: "Video",
    defaultData: { title: "", url: "", caption: "" },
    fields: [
      { key: "title", label: "Title (optional)", type: "text", defaultValue: "" },
      { key: "url", label: "YouTube / Vimeo URL", type: "text", defaultValue: "" },
      { key: "caption", label: "Caption (optional)", type: "text", defaultValue: "" },
    ],
    Render: (d) => {
      const embed = toEmbedUrl(s(d.url));
      if (!embed) return null;
      return (
        <Section>
          <div className="mx-auto max-w-3xl">
            {s(d.title) && (
              <h2 className="mb-6 text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
                {s(d.title)}
              </h2>
            )}
            <div className="aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-[color:var(--s-border)]">
              <iframe
                src={embed}
                title={s(d.title, "Video")}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {s(d.caption) && (
              <p className="mt-3 text-center text-sm text-[color:var(--s-fg-dim)]">{s(d.caption)}</p>
            )}
          </div>
        </Section>
      );
    },
  },

  button: {
    type: "button",
    label: "Button",
    defaultData: { label: "Get in touch", url: "", align: "center" },
    fields: [
      { key: "label", label: "Button text", type: "text", defaultValue: "" },
      { key: "url", label: "Link URL or /slug", type: "text", defaultValue: "" },
      {
        key: "align",
        label: "Alignment",
        type: "select",
        defaultValue: "center",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
    ],
    Render: (d, { accent }) => {
      if (!s(d.label)) return null;
      const url = s(d.url) || "#";
      const align = s(d.align, "center");
      const justify =
        align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
      return (
        <Section>
          <div className={`flex ${justify}`}>
            <a
              href={url}
              className="btn-shine inline-flex rounded-xl px-8 py-4 text-base font-semibold text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              {s(d.label)}
            </a>
          </div>
        </Section>
      );
    },
  },

  stats: {
    type: "stats",
    label: "Stats / numbers",
    defaultData: {
      items: [
        { value: "10k+", label: "Students" },
        { value: "4.9★", label: "Average rating" },
        { value: "7 yrs", label: "Experience" },
      ],
    },
    fields: [
      {
        key: "items",
        label: "Stats",
        type: "list",
        itemLabel: "stat",
        itemFields: [
          { key: "value", label: "Number", type: "text", defaultValue: "" },
          { key: "label", label: "Label", type: "text", defaultValue: "" },
        ],
        defaultValue: [],
      },
    ],
    Render: (d, { accent }) => {
      const items = arr<{ value?: string; label?: string }>(d.items).filter((i) => s(i.value));
      if (items.length === 0) return null;
      return (
        <Section>
          <div className="grid gap-4 sm:grid-cols-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-[color:var(--s-border)] bg-[var(--s-surface)] p-6 text-center"
              >
                <p className="font-sora text-3xl font-extrabold" style={{ color: accent }}>
                  {s(it.value)}
                </p>
                <p className="mt-1 text-sm text-[color:var(--s-fg-muted)]">{s(it.label)}</p>
              </div>
            ))}
          </div>
        </Section>
      );
    },
  },

  divider: {
    type: "divider",
    label: "Divider / spacer",
    defaultData: { line: true },
    fields: [
      { key: "line", label: "Show a line", type: "toggle", defaultValue: true },
    ],
    Render: (d) => (
      <div className="mx-auto max-w-5xl px-4 py-6">
        {d.line === false ? (
          <div className="h-px" />
        ) : (
          <hr className="border-[color:var(--s-border)]" />
        )}
      </div>
    ),
  },

  embed: {
    type: "embed",
    label: "Embed / custom HTML",
    defaultData: { html: "" },
    fields: [
      {
        key: "html",
        label: "HTML embed code",
        type: "textarea",
        defaultValue: "",
      },
    ],
    Render: (d) => {
      const html = s(d.html);
      if (!html) return null;
      return (
        <Section>
          <div
            className="mx-auto max-w-3xl [&_iframe]:w-full"
            // Seller's own embed on their own site.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Section>
      );
    },
  },

  slider: {
    type: "slider",
    label: "Image slider (auto)",
    defaultData: {
      title: "",
      autoplay: true,
      items: [
        { image: "", caption: "", url: "" },
        { image: "", caption: "", url: "" },
      ],
    },
    fields: [
      { key: "title", label: "Section title (optional)", type: "text", defaultValue: "" },
      { key: "autoplay", label: "Auto-play", type: "toggle", defaultValue: true },
      {
        key: "items",
        label: "Slides",
        type: "list",
        itemLabel: "slide",
        itemFields: [
          { key: "image", label: "Image URL", type: "image", defaultValue: "" },
          { key: "caption", label: "Caption (optional)", type: "text", defaultValue: "" },
          { key: "url", label: "Link (optional)", type: "text", defaultValue: "" },
        ],
        defaultValue: [],
      },
    ],
    Render: (d, { accent }) => {
      const slides = arr<{ image?: string; caption?: string; url?: string }>(d.items)
        .filter((s2) => s(s2.image))
        .map((s2) => ({ image: s(s2.image), caption: s(s2.caption), url: s(s2.url) || undefined }));
      if (slides.length === 0) return null;
      return (
        <Section>
          {s(d.title) && (
            <h2 className="mb-8 text-center font-sora text-2xl font-bold tracking-tight text-[color:var(--s-fg)] sm:text-3xl">
              {s(d.title)}
            </h2>
          )}
          <Carousel slides={slides} autoplay={d.autoplay !== false} accent={accent} />
        </Section>
      );
    },
  },

  pagelink: {
    type: "pagelink",
    label: "Link to a page / offer",
    defaultData: {
      title: "Check this out",
      description: "Add a link to any of your pages — payment, store, course, Telegram, lead or landing.",
      cta_label: "Open",
      url: "",
      image: "",
    },
    fields: [
      { key: "title", label: "Title", type: "text", defaultValue: "" },
      { key: "description", label: "Description", type: "textarea", defaultValue: "" },
      { key: "cta_label", label: "Button text", type: "text", defaultValue: "" },
      { key: "url", label: "Page URL (paste from your dashboard)", type: "text", defaultValue: "" },
      { key: "image", label: "Image URL (optional)", type: "image", defaultValue: "" },
    ],
    Render: (d, { accent }) => {
      const url = s(d.url);
      if (!url && !s(d.title)) return null;
      const href = url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : "#";
      return (
        <Section>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 overflow-hidden rounded-2xl border border-[color:var(--s-border)] bg-[var(--s-surface)] p-6 sm:flex-row">
            {s(d.image) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s(d.image)}
                alt=""
                className="h-28 w-full rounded-xl object-cover sm:h-24 sm:w-40"
              />
            )}
            <div className="flex-1 text-center sm:text-left">
              {s(d.title) && (
                <h3 className="font-sora text-lg font-bold text-[color:var(--s-fg)]">
                  {s(d.title)}
                </h3>
              )}
              {s(d.description) && (
                <p className="mt-1 text-sm text-[color:var(--s-fg-muted)]">{s(d.description)}</p>
              )}
            </div>
            {s(d.cta_label) && (
              <a
                href={href}
                className="btn-shine inline-flex shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg"
                style={{ backgroundColor: accent }}
              >
                {s(d.cta_label)}
              </a>
            )}
          </div>
        </Section>
      );
    },
  },
};

/** Convert a YouTube/Vimeo watch URL to an embeddable URL. Returns "" if unknown. */
function toEmbedUrl(url: string): string {
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return "";
}

export const BLOCK_LIST = Object.values(BLOCKS);
