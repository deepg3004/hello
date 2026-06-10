// =============================================================================
// AI → builder document mapping. PURE (no server-only / no SDK) so it can be
// unit-tested and is the single trusted boundary between model output and what
// gets persisted/rendered. The model returns a deliberately SIMPLE intermediate
// shape (one flat list of widgets per section); this maps + sanitises it into a
// real BuilderDocument (PAGE -> SECTIONS -> COLUMNS -> WIDGETS), dropping
// anything unrecognised. The model can NOT emit raw HTML/script widgets — only
// the safe, typed widgets below — so generated pages can't inject markup.
// =============================================================================

import {
  type BuilderDocument,
  type SectionNode,
  type WidgetNode,
  uid,
  newColumn,
  emptyDocument,
} from "@/lib/builder/types";

// ── The shape we ask the model for (also the JSON-schema source of truth). ───
export type AiWidgetType =
  | "heading"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "testimonial"
  | "pricing"
  | "icon"
  | "video"
  | "faq"
  | "features"
  | "stats"
  | "badges"
  | "cta_banner";

export interface AiWidget {
  type: AiWidgetType;
  text?: string; // heading / text / cta sub-text
  level?: "h1" | "h2" | "h3"; // heading
  align?: "left" | "center" | "right";
  label?: string; // button / cta / pricing cta
  url?: string; // button / image / video / cta
  variant?: "filled" | "outline"; // button
  color?: string; // button / icon / features / stats / cta accent (hex)
  src?: string; // image
  alt?: string; // image
  quote?: string; // testimonial
  author?: string; // testimonial
  role?: string; // testimonial
  name?: string; // pricing plan name OR lucide icon name
  price?: string; // pricing
  period?: string; // pricing (e.g. "/mo")
  features?: string[]; // pricing
  size?: number; // icon
  height?: number; // spacer
  heading?: string; // cta_banner headline
  // List rows for faq / features / stats / badges — interpreted per type:
  //   faq:{q,a}  features:{icon,title,text}  stats:{value,label}  badges:{text}
  items?: Array<Record<string, unknown>>;
}

export interface AiSection {
  widgets: AiWidget[];
}

export interface AiSite {
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  theme?: { primary?: string; accent?: string; background?: string };
  sections: AiSection[];
}

/** JSON schema handed to the Messages API (output_config.format). additional-
 *  Properties:false everywhere so the model can't smuggle extra keys. */
export const AI_SITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "sections"],
  properties: {
    title: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    theme: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: { type: "string" },
        accent: { type: "string" },
        background: { type: "string" },
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["widgets"],
        properties: {
          widgets: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type"],
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "heading",
                    "text",
                    "button",
                    "image",
                    "divider",
                    "spacer",
                    "testimonial",
                    "pricing",
                    "icon",
                    "video",
                  ],
                },
                text: { type: "string" },
                level: { type: "string", enum: ["h1", "h2", "h3"] },
                align: { type: "string", enum: ["left", "center", "right"] },
                label: { type: "string" },
                url: { type: "string" },
                variant: { type: "string", enum: ["filled", "outline"] },
                color: { type: "string" },
                src: { type: "string" },
                alt: { type: "string" },
                quote: { type: "string" },
                author: { type: "string" },
                role: { type: "string" },
                name: { type: "string" },
                price: { type: "string" },
                period: { type: "string" },
                features: { type: "array", items: { type: "string" } },
                size: { type: "number" },
                height: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
} as const;

const ALIGNS = new Set(["left", "center", "right"]);
const HEX = /^#[0-9a-fA-F]{3,8}$/;
// Only allow http(s) media URLs — never javascript:/data: in src/href.
const SAFE_URL = /^https?:\/\//i;

function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function color(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fallback;
}
function align(v: unknown, fallback = "left"): string {
  return typeof v === "string" && ALIGNS.has(v) ? v : fallback;
}
function url(v: unknown): string {
  const s = str(v, 1000).trim();
  return SAFE_URL.test(s) ? s : "";
}
function num(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
function rows(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v)
    ? (v.filter((x) => x && typeof x === "object") as Array<Record<string, unknown>>)
    : [];
}

/** Map one AI widget → a builder WidgetNode, or null to drop it. */
function mapWidget(w: AiWidget): WidgetNode | null {
  if (!w || typeof w !== "object") return null;
  const id = uid("w");
  switch (w.type) {
    case "heading": {
      const text = str(w.text, 300);
      if (!text) return null;
      const level = w.level === "h1" || w.level === "h3" ? w.level : "h2";
      return { id, type: "heading", content: { text, level, align: align(w.align, "center") } };
    }
    case "text": {
      const text = str(w.text, 4000);
      if (!text) return null;
      return { id, type: "text", content: { text, align: align(w.align) } };
    }
    case "button": {
      const label = str(w.label, 120) || "Learn more";
      return {
        id,
        type: "button",
        content: {
          label,
          url: url(w.url) || "#",
          align: align(w.align, "center"),
          variant: w.variant === "outline" ? "outline" : "filled",
          color: color(w.color, "#4f46e5"),
        },
      };
    }
    case "image": {
      const src = url(w.src);
      if (!src) return null; // an image with no usable URL renders broken
      return {
        id,
        type: "image",
        content: { src, alt: str(w.alt, 200), align: align(w.align, "center"), rounded: true },
      };
    }
    case "divider":
      return { id, type: "divider", content: { color: color(w.color, "#e5e7eb") } };
    case "spacer":
      return { id, type: "spacer", content: { height: num(w.height, 32, 4, 240) } };
    case "testimonial": {
      const quote = str(w.quote, 600);
      if (!quote) return null;
      return {
        id,
        type: "testimonial",
        content: { quote, author: str(w.author, 120), role: str(w.role, 160), avatar: url(w.url) },
      };
    }
    case "pricing": {
      const name = str(w.name, 80) || "Plan";
      const features = Array.isArray(w.features)
        ? w.features.map((f) => str(f, 160)).filter(Boolean).slice(0, 12)
        : [];
      return {
        id,
        type: "pricing",
        content: {
          name,
          price: str(w.price, 40),
          period: str(w.period, 24),
          features: features.join("\n"),
          cta_label: str(w.label, 60) || "Get started",
          cta_url: url(w.url) || "#",
          color: color(w.color, "#4f46e5"),
        },
      };
    }
    case "icon":
      return {
        id,
        type: "icon",
        content: {
          name: str(w.name, 60) || "Star",
          size: num(w.size, 40, 12, 160),
          color: color(w.color, "#4f46e5"),
          align: align(w.align, "center"),
        },
      };
    case "video": {
      const u = url(w.url);
      if (!u) return null;
      return { id, type: "video", content: { url: u } };
    }
    case "faq": {
      const list = rows(w.items)
        .map((it) => ({ q: str(it.q, 200), a: str(it.a, 1000) }))
        .filter((x) => x.q)
        .slice(0, 12);
      if (!list.length) return null;
      return { id, type: "faq", content: { items: list } };
    }
    case "features": {
      const list = rows(w.items)
        .map((it) => ({ icon: str(it.icon, 60) || "Star", title: str(it.title, 120), text: str(it.text, 400) }))
        .filter((x) => x.title || x.text)
        .slice(0, 9);
      if (!list.length) return null;
      return { id, type: "features", content: { items: list, color: color(w.color, "#4f46e5") } };
    }
    case "stats": {
      const list = rows(w.items)
        .map((it) => ({ value: str(it.value, 40), label: str(it.label, 80) }))
        .filter((x) => x.value)
        .slice(0, 6);
      if (!list.length) return null;
      return { id, type: "stats", content: { items: list, color: color(w.color, "#4f46e5") } };
    }
    case "badges": {
      const list = rows(w.items)
        .map((it) => ({ text: str(it.text, 80) }))
        .filter((x) => x.text)
        .slice(0, 8);
      if (!list.length) return null;
      return { id, type: "badges", content: { items: list, align: align(w.align, "center") } };
    }
    case "cta_banner": {
      const heading = str(w.heading, 200);
      if (!heading) return null;
      return {
        id,
        type: "cta_banner",
        content: {
          heading,
          text: str(w.text, 400),
          label: str(w.label, 60) || "Get started",
          url: url(w.url) || "#",
          color: color(w.color, "#4f46e5"),
        },
      };
    }
    default:
      return null;
  }
}

function mapSection(s: AiSection): SectionNode | null {
  if (!s || !Array.isArray(s.widgets)) return null;
  const widgets = s.widgets.map(mapWidget).filter((w): w is WidgetNode => w !== null);
  if (widgets.length === 0) return null;
  const col = newColumn(100);
  col.widgets = widgets;
  return { id: uid("sec"), columns: [col], settings: {} };
}

/** Turn validated AI output into a renderable BuilderDocument. Never throws —
 *  a fully-unusable payload degrades to an empty (but valid) document. */
export function documentFromAiSite(ai: AiSite): BuilderDocument {
  const sections = Array.isArray(ai?.sections)
    ? ai.sections.map(mapSection).filter((s): s is SectionNode => s !== null)
    : [];
  if (sections.length === 0) return emptyDocument();
  return { sections: sections.slice(0, 30) };
}
