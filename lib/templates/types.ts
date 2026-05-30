// =============================================================================
// Shared types for InvoxAI page templates.
//
// A template is a (definition + Render) pair. The DEFINITION is the schema the
// page builder uses to render the customization form. The RENDER is the React
// component that draws the published page using the customised values.
//
// Field values are keyed flat across the whole template — sections are purely
// a form-UX grouping. Inside a `list` field, each item carries the schema in
// `itemFields`.
// =============================================================================

import type { ReactNode } from "react";

export type FieldType =
  | "text"
  | "textarea"
  | "image"
  | "color"
  | "toggle"
  | "number"
  | "list";

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  /** Default initial value for this field. */
  defaultValue: unknown;
  placeholder?: string;
  /** Short help text shown under the input in the builder. */
  hint?: string;
  /** For `list` fields — per-item schema. */
  itemFields?: FieldConfig[];
  /** For `list` fields — what to call a single item ("testimonial", "FAQ"...). */
  itemLabel?: string;
  /** For `list` fields — limits. */
  minItems?: number;
  maxItems?: number;
}

export interface TemplateSection {
  id: string;
  /** Human label in the builder sidebar. */
  label: string;
  /** Free-form section kind, e.g. "hero", "benefits", "checkout" — used for icons. */
  type: string;
  fields: FieldConfig[];
}

export type TemplateCategory =
  | "payment"
  | "landing"
  | "telegram"
  | "lead_magnet";

/** Maps to pages.type in the DB (payment / landing / lead_magnet). */
export type PageDbType = "payment" | "landing" | "lead_magnet";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** Maps to pages.type column. */
  dbType: PageDbType;
  /** Public thumbnail URL or inline svg. Keep simple — public asset paths or data URIs. */
  thumbnail: string;
  /** Colour theme summary, shown in the picker. */
  theme: { name: string; primary: string; background: string };
  sections: TemplateSection[];
}

export interface TemplateRenderProps {
  values: Record<string, unknown>;
  /** Present once the page is saved. Used for analytics / checkout. */
  pageId?: string;
  /** Pre-fetched product for payment templates. */
  product?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    currency: string;
  } | null;
  /** Set to true inside the preview iframe — disables analytics + view bump. */
  isPreview?: boolean;
  /** Page-level order-bump runtime resolved at request time. */
  bumpRuntime?: import("@/components/templates/shared/types").BumpRuntime;
}

export type TemplateRender = (props: TemplateRenderProps) => ReactNode;

export interface Template {
  definition: TemplateDefinition;
  Render: TemplateRender;
  /** Flat dictionary of default values, derived once at module load. */
  defaultValues: Record<string, unknown>;
}
