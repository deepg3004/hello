// Widget registry for the website builder. ONE place defines each widget's
// metadata (label, icon, default content) AND its render, so the editor panel,
// the editor canvas, and the public renderer all stay in sync. Mirrors the
// existing storefront block registry pattern.
//
// Phase 1 widgets: Heading, Text, Image, Button (presentational, server-safe).
// More widgets (form, gallery, Razorpay, etc.) are added in later phases.

import type { ReactNode } from "react";
import {
  Heading as HeadingIcon,
  Type as TextIcon,
  Image as ImageIcon,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";

export interface WidgetDef {
  type: string;
  label: string;
  icon: LucideIcon;
  /** Default content when the widget is first dropped. */
  defaultContent: Record<string, unknown>;
  /** Pure render from content (+ style later). Server-safe for Phase 1 widgets. */
  Render: (content: Record<string, unknown>, style?: Record<string, unknown>) => ReactNode;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const s = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const alignClass = (a: unknown): string =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

export const WIDGETS: Record<string, WidgetDef> = {
  heading: {
    type: "heading",
    label: "Heading",
    icon: HeadingIcon,
    defaultContent: { text: "Your heading", level: "h2", align: "left" },
    Render: (c) => {
      const Tag = (["h1", "h2", "h3"].includes(s(c.level)) ? s(c.level) : "h2") as
        | "h1"
        | "h2"
        | "h3";
      const size =
        Tag === "h1"
          ? "text-4xl sm:text-5xl"
          : Tag === "h2"
            ? "text-3xl sm:text-4xl"
            : "text-2xl sm:text-3xl";
      return (
        <Tag className={`${size} font-bold tracking-tight ${alignClass(c.align)}`}>
          {s(c.text, "Your heading")}
        </Tag>
      );
    },
  },

  text: {
    type: "text",
    label: "Text",
    icon: TextIcon,
    defaultContent: {
      text: "Write something compelling about your offer here.",
      align: "left",
    },
    Render: (c) => (
      <p className={`whitespace-pre-wrap leading-relaxed text-current/80 ${alignClass(c.align)}`}>
        {s(c.text)}
      </p>
    ),
  },

  image: {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    defaultContent: { src: "", alt: "", align: "center", rounded: true },
    Render: (c) => {
      const src = s(c.src);
      const wrap =
        c.align === "left" ? "mr-auto" : c.align === "right" ? "ml-auto" : "mx-auto";
      if (!src) {
        return (
          <div
            className={`flex aspect-video w-full max-w-xl items-center justify-center rounded-xl border border-dashed border-current/20 bg-current/5 text-sm text-current/40 ${wrap}`}
          >
            Image — add a URL
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={s(c.alt)}
          className={`block w-full max-w-xl object-cover ${c.rounded ? "rounded-xl" : ""} ${wrap}`}
        />
      );
    },
  },

  button: {
    type: "button",
    label: "Button",
    icon: MousePointerClick,
    defaultContent: {
      label: "Click here",
      url: "#",
      align: "left",
      variant: "filled",
      color: "#4f46e5",
    },
    Render: (c) => {
      const filled = c.variant !== "outline";
      const color = s(c.color, "#4f46e5");
      return (
        <div className={alignClass(c.align)}>
          <a
            href={s(c.url, "#")}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={
              filled
                ? { background: color, color: "#fff" }
                : { border: `2px solid ${color}`, color }
            }
          >
            {s(c.label, "Click here")}
          </a>
        </div>
      );
    },
  },
};

/** Ordered list for the widget panel. */
export const WIDGET_LIST: WidgetDef[] = Object.values(WIDGETS);

export function widgetDef(type: string): WidgetDef | undefined {
  return WIDGETS[type];
}
