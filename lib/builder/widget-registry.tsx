// Widget registry for the website builder. ONE place per widget defines:
//   • metadata (label, icon)
//   • `fields` — a schema the settings panel renders generically (so adding a
//     widget needs no settings-panel changes)
//   • `defaultContent`
//   • `Render` — pure render from content (style + animation applied by the
//     renderer/editor wrapper)
// Shared by the editor panel, the editor canvas, and the public renderer.

import type { ReactNode } from "react";
import {
  Heading as HeadingIcon,
  Type as TextIcon,
  Image as ImageIcon,
  MousePointerClick,
  Star,
  Minus as DividerIcon,
  StretchVertical,
  Video as VideoIcon,
  Share2,
  Quote,
  Tags,
  Code2,
  MailQuestion,
  ShoppingCart,
  Menu as MenuIcon,
  HelpCircle,
  LayoutGrid,
  TrendingUp,
  BadgeCheck,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

import { LeadFormWidget } from "@/components/builder/widgets/LeadFormWidget";
import { BuyWidget } from "@/components/builder/widgets/BuyWidget";
import { BuilderIcon } from "@/components/builder/widgets/BuilderIcon";
import { sanitizeEmbedHtml } from "@/lib/sanitize-embed";

// ── Field schema (rendered by the settings panel) ─────────────────────────────
export type FieldSpec =
  | { key: string; label: string; type: "text" | "textarea" | "url" | "color" | "icon" }
  | { key: string; label: string; type: "number" }
  | { key: string; label: string; type: "select"; options: Array<[string, string]> }
  | { key: string; label: string; type: "list"; itemLabel: string; itemFields: FieldSpec[] };

export interface WidgetDef {
  type: string;
  label: string;
  icon: LucideIcon;
  fields: FieldSpec[];
  defaultContent: Record<string, unknown>;
  Render: (content: Record<string, unknown>) => ReactNode;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const s = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const n = (v: unknown, fb = 0): number => (typeof v === "number" ? v : fb);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const alignClass = (a: unknown): string =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
const ALIGN: Array<[string, string]> = [["left", "Left"], ["center", "Center"], ["right", "Right"]];

/** YouTube/Vimeo watch URL → embeddable URL. */
function toEmbed(url: string): string {
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const v = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  return url;
}

export const WIDGETS: Record<string, WidgetDef> = {
  heading: {
    type: "heading",
    label: "Heading",
    icon: HeadingIcon,
    fields: [
      { key: "text", label: "Text", type: "text" },
      { key: "level", label: "Level", type: "select", options: [["h1", "H1"], ["h2", "H2"], ["h3", "H3"]] },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: { text: "Your heading", level: "h2", align: "left" },
    Render: (c) => {
      const Tag = (["h1", "h2", "h3"].includes(s(c.level)) ? s(c.level) : "h2") as "h1" | "h2" | "h3";
      const size = Tag === "h1" ? "text-4xl sm:text-5xl" : Tag === "h2" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl";
      return <Tag className={`${size} font-bold tracking-tight ${alignClass(c.align)}`}>{s(c.text, "Your heading")}</Tag>;
    },
  },

  text: {
    type: "text",
    label: "Text",
    icon: TextIcon,
    fields: [
      { key: "text", label: "Text", type: "textarea" },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: { text: "Write something compelling about your offer here.", align: "left" },
    Render: (c) => (
      <p className={`whitespace-pre-wrap leading-relaxed text-current/80 ${alignClass(c.align)}`}>{s(c.text)}</p>
    ),
  },

  image: {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    fields: [
      { key: "src", label: "Image URL", type: "url" },
      { key: "alt", label: "Alt text", type: "text" },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: { src: "", alt: "", align: "center", rounded: true },
    Render: (c) => {
      const src = s(c.src);
      const wrap = c.align === "left" ? "mr-auto" : c.align === "right" ? "ml-auto" : "mx-auto";
      if (!src)
        return (
          <div className={`flex aspect-video w-full max-w-xl items-center justify-center rounded-xl border border-dashed border-current/20 bg-current/5 text-sm text-current/40 ${wrap}`}>
            Image — add a URL
          </div>
        );
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={s(c.alt)} className={`block w-full max-w-xl rounded-xl object-cover ${wrap}`} />;
    },
  },

  button: {
    type: "button",
    label: "Button",
    icon: MousePointerClick,
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "url", label: "Link URL", type: "url" },
      { key: "variant", label: "Style", type: "select", options: [["filled", "Filled"], ["outline", "Outline"]] },
      { key: "color", label: "Color", type: "color" },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: { label: "Click here", url: "#", align: "left", variant: "filled", color: "#4f46e5" },
    Render: (c) => {
      const filled = c.variant !== "outline";
      const color = s(c.color, "#4f46e5");
      return (
        <div className={alignClass(c.align)}>
          <a
            href={s(c.url, "#")}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={filled ? { background: color, color: "#fff" } : { border: `2px solid ${color}`, color }}
          >
            {s(c.label, "Click here")}
          </a>
        </div>
      );
    },
  },

  icon: {
    type: "icon",
    label: "Icon",
    icon: Star,
    fields: [
      { key: "name", label: "Icon (lucide name)", type: "icon" },
      { key: "size", label: "Size (px)", type: "number" },
      { key: "color", label: "Color", type: "color" },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: { name: "Star", size: 40, color: "#4f46e5", align: "left" },
    Render: (c) => (
      <div className={alignClass(c.align)}>
        <BuilderIcon name={s(c.name, "Star")} size={n(c.size, 40)} color={s(c.color, "#4f46e5")} />
      </div>
    ),
  },

  spacer: {
    type: "spacer",
    label: "Spacer",
    icon: StretchVertical,
    fields: [{ key: "height", label: "Height (px)", type: "number" }],
    defaultContent: { height: 40 },
    Render: (c) => <div style={{ height: `${n(c.height, 40)}px` }} aria-hidden />,
  },

  divider: {
    type: "divider",
    label: "Divider",
    icon: DividerIcon,
    fields: [{ key: "color", label: "Color", type: "color" }],
    defaultContent: { color: "rgba(0,0,0,0.12)" },
    Render: (c) => <hr style={{ borderColor: s(c.color, "rgba(0,0,0,0.12)") }} className="my-2" />,
  },

  video: {
    type: "video",
    label: "Video",
    icon: VideoIcon,
    fields: [{ key: "url", label: "YouTube / Vimeo URL", type: "url" }],
    defaultContent: { url: "" },
    Render: (c) => {
      const src = toEmbed(s(c.url));
      if (!src)
        return (
          <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-current/20 bg-current/5 text-sm text-current/40">
            Video — paste a YouTube/Vimeo link
          </div>
        );
      return (
        <div className="aspect-video w-full overflow-hidden rounded-xl">
          <iframe src={src} className="h-full w-full" allowFullScreen title="Video" />
        </div>
      );
    },
  },

  social: {
    type: "social",
    label: "Social Icons",
    icon: Share2,
    fields: [
      {
        key: "items",
        label: "Links",
        type: "list",
        itemLabel: "link",
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "url", label: "URL", type: "url" },
        ],
      },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: {
      align: "left",
      items: [
        { icon: "Instagram", url: "#" },
        { icon: "Send", url: "#" },
        { icon: "Youtube", url: "#" },
      ],
    },
    Render: (c) => {
      const items = arr<{ icon?: string; url?: string }>(c.items);
      const wrap = c.align === "center" ? "justify-center" : c.align === "right" ? "justify-end" : "justify-start";
      return (
        <div className={`flex flex-wrap items-center gap-3 ${wrap}`}>
          {items.map((it, i) => (
            <a key={i} href={s(it.url, "#")} target="_blank" rel="noreferrer" className="opacity-80 transition hover:opacity-100">
              <BuilderIcon name={s(it.icon, "Link")} size={22} />
            </a>
          ))}
        </div>
      );
    },
  },

  testimonial: {
    type: "testimonial",
    label: "Testimonial",
    icon: Quote,
    fields: [
      { key: "quote", label: "Quote", type: "textarea" },
      { key: "author", label: "Author", type: "text" },
      { key: "role", label: "Role / company", type: "text" },
      { key: "avatar", label: "Avatar URL", type: "url" },
    ],
    defaultContent: { quote: "This completely changed how I work — highly recommend.", author: "Happy customer", role: "", avatar: "" },
    Render: (c) => (
      <figure className="rounded-2xl border border-current/10 bg-current/5 p-6">
        <Quote className="h-6 w-6 opacity-30" />
        <blockquote className="mt-2 text-lg leading-relaxed">{s(c.quote)}</blockquote>
        <figcaption className="mt-4 flex items-center gap-3">
          {s(c.avatar) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s(c.avatar)} alt={s(c.author)} className="h-10 w-10 rounded-full object-cover" />
          ) : null}
          <div>
            <div className="font-semibold">{s(c.author, "Customer")}</div>
            {s(c.role) && <div className="text-sm opacity-60">{s(c.role)}</div>}
          </div>
        </figcaption>
      </figure>
    ),
  },

  pricing: {
    type: "pricing",
    label: "Pricing Card",
    icon: Tags,
    fields: [
      { key: "name", label: "Plan name", type: "text" },
      { key: "price", label: "Price", type: "text" },
      { key: "period", label: "Period (e.g. /mo)", type: "text" },
      { key: "features", label: "Features (one per line)", type: "textarea" },
      { key: "cta_label", label: "Button label", type: "text" },
      { key: "cta_url", label: "Button link", type: "url" },
      { key: "color", label: "Accent color", type: "color" },
    ],
    defaultContent: {
      name: "Pro",
      price: "₹1,499",
      period: "/mo",
      features: "Everything you need\nPriority support\nCancel anytime",
      cta_label: "Get started",
      cta_url: "#",
      color: "#4f46e5",
    },
    Render: (c) => {
      const feats = s(c.features).split("\n").map((f) => f.trim()).filter(Boolean);
      const color = s(c.color, "#4f46e5");
      return (
        <div className="rounded-2xl border border-current/10 bg-current/5 p-6 text-center">
          <div className="text-sm font-semibold uppercase tracking-wide opacity-70">{s(c.name, "Plan")}</div>
          <div className="mt-2 text-4xl font-extrabold">
            {s(c.price)}
            <span className="text-base font-medium opacity-60">{s(c.period)}</span>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {feats.map((f, i) => (
              <li key={i} className="opacity-80">{f}</li>
            ))}
          </ul>
          <a href={s(c.cta_url, "#")} className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: color }}>
            {s(c.cta_label, "Get started")}
          </a>
        </div>
      );
    },
  },

  html: {
    type: "html",
    label: "HTML Embed",
    icon: Code2,
    fields: [{ key: "html", label: "Custom HTML", type: "textarea" }],
    defaultContent: { html: "" },
    Render: (c) => {
      const html = sanitizeEmbedHtml(s(c.html));
      if (!html) return <div className="rounded-lg border border-dashed border-current/20 p-4 text-sm text-current/40">HTML embed — add code</div>;
      return <div className="[&_iframe]:w-full" dangerouslySetInnerHTML={{ __html: html }} />;
    },
  },

  menu: {
    type: "menu",
    label: "Menu",
    icon: MenuIcon,
    fields: [
      {
        key: "items",
        label: "Links",
        type: "list",
        itemLabel: "link",
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          { key: "url", label: "URL", type: "url" },
        ],
      },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: {
      align: "left",
      items: [
        { label: "Home", url: "/" },
        { label: "About", url: "#" },
        { label: "Contact", url: "#" },
      ],
    },
    Render: (c) => {
      const items = arr<{ label?: string; url?: string }>(c.items);
      const wrap = c.align === "center" ? "justify-center" : c.align === "right" ? "justify-end" : "justify-start";
      return (
        <nav className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${wrap}`}>
          {items.map((it, i) => (
            <a key={i} href={s(it.url, "#")} className="text-sm font-medium opacity-80 transition hover:opacity-100">
              {s(it.label, "Link")}
            </a>
          ))}
        </nav>
      );
    },
  },

  // ── Interactive (the point of the leads + payment page types) ────────────────
  form: {
    type: "form",
    label: "Lead Form",
    icon: MailQuestion,
    fields: [
      { key: "title", label: "Form title", type: "text" },
      { key: "button", label: "Submit button", type: "text" },
      { key: "fields", label: "Fields", type: "select", options: [["name_email", "Name + Email"], ["name_email_phone", "Name + Email + Phone"], ["full", "Name + Email + Phone + Message"]] },
    ],
    defaultContent: { title: "Get in touch", button: "Submit", fields: "full" },
    Render: (c) => <LeadFormWidget content={c} />,
  },

  buy: {
    type: "buy",
    label: "Buy / Product",
    icon: ShoppingCart,
    fields: [
      { key: "name", label: "Product name", type: "text" },
      { key: "price", label: "Price (display)", type: "text" },
      { key: "slug", label: "Checkout page slug (/p/<slug>)", type: "text" },
      { key: "label", label: "Button label", type: "text" },
      { key: "color", label: "Accent color", type: "color" },
    ],
    defaultContent: { name: "Your product", price: "₹999", slug: "", label: "Buy now", color: "#16a34a" },
    Render: (c) => <BuyWidget content={c} />,
  },

  // ── Content blocks (presentational, SSR-safe) ────────────────────────────────
  faq: {
    type: "faq",
    label: "FAQ",
    icon: HelpCircle,
    fields: [
      {
        key: "items",
        label: "Questions",
        type: "list",
        itemLabel: "question",
        itemFields: [
          { key: "q", label: "Question", type: "text" },
          { key: "a", label: "Answer", type: "textarea" },
        ],
      },
    ],
    defaultContent: {
      items: [
        { q: "How does it work?", a: "Sign up, pick a plan, and you're ready to go in minutes." },
        { q: "Can I cancel anytime?", a: "Yes — there are no lock-in contracts. Cancel whenever you like." },
        { q: "Do you offer support?", a: "Absolutely. Our team is here to help whenever you need us." },
      ],
    },
    // Native <details> so it works on the server-rendered public page (no JS).
    Render: (c) => {
      const items = arr<{ q?: string; a?: string }>(c.items);
      return (
        <div className="mx-auto max-w-2xl divide-y divide-current/10 rounded-2xl border border-current/10 bg-current/5">
          {items.map((it, i) => (
            <details key={i} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {s(it.q, "Question")}
                <span className="opacity-50 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed opacity-80">{s(it.a)}</p>
            </details>
          ))}
        </div>
      );
    },
  },

  features: {
    type: "features",
    label: "Feature Grid",
    icon: LayoutGrid,
    fields: [
      {
        key: "items",
        label: "Features",
        type: "list",
        itemLabel: "feature",
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text" },
          { key: "text", label: "Description", type: "textarea" },
        ],
      },
      { key: "color", label: "Icon color", type: "color" },
    ],
    defaultContent: {
      color: "#4f46e5",
      items: [
        { icon: "Zap", title: "Fast setup", text: "Go live in minutes, not weeks." },
        { icon: "ShieldCheck", title: "Secure", text: "Your data is encrypted and safe." },
        { icon: "Rocket", title: "Built to scale", text: "Grows with you, no replatforming." },
      ],
    },
    Render: (c) => {
      const items = arr<{ icon?: string; title?: string; text?: string }>(c.items);
      const color = s(c.color, "#4f46e5");
      return (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border border-current/10 bg-current/5 p-5">
              <BuilderIcon name={s(it.icon, "Star")} size={28} color={color} />
              <h3 className="mt-3 text-lg font-semibold">{s(it.title, "Feature")}</h3>
              <p className="mt-1 text-sm leading-relaxed opacity-75">{s(it.text)}</p>
            </div>
          ))}
        </div>
      );
    },
  },

  stats: {
    type: "stats",
    label: "Stats Counter",
    icon: TrendingUp,
    fields: [
      {
        key: "items",
        label: "Stats",
        type: "list",
        itemLabel: "stat",
        itemFields: [
          { key: "value", label: "Value", type: "text" },
          { key: "label", label: "Label", type: "text" },
        ],
      },
      { key: "color", label: "Number color", type: "color" },
    ],
    defaultContent: {
      color: "#4f46e5",
      items: [
        { value: "10k+", label: "Happy customers" },
        { value: "4.9★", label: "Average rating" },
        { value: "99.9%", label: "Uptime" },
      ],
    },
    Render: (c) => {
      const items = arr<{ value?: string; label?: string }>(c.items);
      const color = s(c.color, "#4f46e5");
      return (
        <div className="flex flex-wrap items-stretch justify-center gap-x-10 gap-y-6 text-center">
          {items.map((it, i) => (
            <div key={i}>
              <div className="text-4xl font-extrabold sm:text-5xl" style={{ color }}>{s(it.value, "0")}</div>
              <div className="mt-1 text-sm font-medium opacity-70">{s(it.label)}</div>
            </div>
          ))}
        </div>
      );
    },
  },

  badges: {
    type: "badges",
    label: "Trust Badges",
    icon: BadgeCheck,
    fields: [
      {
        key: "items",
        label: "Badges",
        type: "list",
        itemLabel: "badge",
        itemFields: [{ key: "text", label: "Text", type: "text" }],
      },
      { key: "align", label: "Alignment", type: "select", options: ALIGN },
    ],
    defaultContent: {
      align: "center",
      items: [
        { text: "Secure checkout" },
        { text: "30-day money-back guarantee" },
        { text: "24/7 support" },
      ],
    },
    Render: (c) => {
      const items = arr<{ text?: string }>(c.items);
      const wrap = c.align === "left" ? "justify-start" : c.align === "right" ? "justify-end" : "justify-center";
      return (
        <div className={`flex flex-wrap items-center gap-3 ${wrap}`}>
          {items.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-current/10 bg-current/5 px-3 py-1.5 text-sm font-medium opacity-80">
              <BadgeCheck className="h-4 w-4 text-emerald-500" />
              {s(it.text, "Badge")}
            </span>
          ))}
        </div>
      );
    },
  },

  cta_banner: {
    type: "cta_banner",
    label: "CTA Banner",
    icon: Megaphone,
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "text", label: "Sub-text", type: "textarea" },
      { key: "label", label: "Button label", type: "text" },
      { key: "url", label: "Button link", type: "url" },
      { key: "color", label: "Accent color", type: "color" },
    ],
    defaultContent: {
      heading: "Ready to get started?",
      text: "Join today and see results in your first week.",
      label: "Get started",
      url: "#",
      color: "#4f46e5",
    },
    Render: (c) => {
      const color = s(c.color, "#4f46e5");
      return (
        <div className="rounded-2xl px-6 py-10 text-center" style={{ background: `${color}14` }}>
          <h2 className="text-2xl font-bold sm:text-3xl">{s(c.heading, "Ready to get started?")}</h2>
          {s(c.text) && <p className="mx-auto mt-2 max-w-xl text-current/70">{s(c.text)}</p>}
          <a
            href={s(c.url, "#")}
            className="mt-5 inline-flex items-center justify-center rounded-xl px-7 py-3 text-sm font-semibold text-white"
            style={{ background: color }}
          >
            {s(c.label, "Get started")}
          </a>
        </div>
      );
    },
  },
};

export const WIDGET_LIST: WidgetDef[] = Object.values(WIDGETS);

export function widgetDef(type: string): WidgetDef | undefined {
  return WIDGETS[type];
}
