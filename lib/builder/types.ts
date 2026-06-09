// Elementor-style document model for the website builder.
// Tree: PAGE (document) -> SECTIONS -> COLUMNS -> WIDGETS.
// The whole tree is stored as JSON in builder_pages.content_json and is rendered
// by the SHARED BlockRenderer (used by both the editor canvas and the public
// page), so what a seller builds is exactly what visitors see.

export type Device = "desktop" | "tablet" | "mobile";

/** A leaf element (heading, text, image, button, …). `content` holds the
 *  widget's data; `style` holds per-device visual overrides (Phase 2);
 *  `animation` is a framer-motion entrance preset key (Phase 2). */
export interface WidgetNode {
  id: string;
  type: string;
  content: Record<string, unknown>;
  // ResponsiveStyle from lib/builder/style — kept loose here to avoid a circular
  // import (style.ts imports Device from this file).
  style?: Record<string, unknown>;
  animation?: string;
}

/** A column inside a section. `width` is a percentage (single-column = 100). */
export interface ColumnNode {
  id: string;
  width: number;
  widgets: WidgetNode[];
}

/** A horizontal band; holds one or more columns. `settings` carries section-level
 *  styling (background, padding) — filled out in later phases. */
export interface SectionNode {
  id: string;
  columns: ColumnNode[];
  settings?: Record<string, unknown>;
}

export interface BuilderDocument {
  sections: SectionNode[];
}

/** Short unique id for nodes. (App code — Math.random is fine here; the editor
 *  also re-keys on the server when applying templates.) */
export function uid(prefix = "n"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newColumn(width = 100): ColumnNode {
  return { id: uid("col"), width, widgets: [] };
}

export function newSection(): SectionNode {
  return { id: uid("sec"), columns: [newColumn(100)], settings: {} };
}

/** A blank document with one section + one full-width column to drop into. */
export function emptyDocument(): BuilderDocument {
  return { sections: [newSection()] };
}

/** Narrow an unknown jsonb value into a BuilderDocument (defensive). */
export function asDocument(value: unknown): BuilderDocument {
  const v = value as Partial<BuilderDocument> | null | undefined;
  if (v && Array.isArray(v.sections)) return { sections: v.sections };
  return emptyDocument();
}
