import type { FieldConfig, TemplateDefinition } from "./types";

/** Walk every field of a definition and build the flat defaults dict. */
export function extractDefaults(
  def: TemplateDefinition,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of def.sections) {
    for (const field of section.fields) {
      out[field.key] = field.defaultValue;
    }
  }
  return out;
}

/** Read a typed value with a fallback. */
export function readField<T>(
  values: Record<string, unknown>,
  key: string,
  fallback: T,
): T {
  const v = values[key];
  if (v === undefined || v === null) return fallback;
  // Guard against legacy / wrong-type stored values that would crash a template
  // at render time (e.g. a list field saved as a string → `.map` throws, which
  // 500s the page and surfaces as a Cloudflare 520 in the live preview).
  if (Array.isArray(fallback) && !Array.isArray(v)) return fallback;
  if (typeof fallback === "number" && typeof v !== "number") {
    const n = Number(v);
    return (Number.isFinite(n) ? n : fallback) as T;
  }
  return v as T;
}

/** Encode customisation values into a URL-safe base64 string (for preview iframe). */
export function encodeValues(values: Record<string, unknown>): string {
  const json = JSON.stringify(values);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  // Browser: btoa needs latin-1 — encode UTF-8 first.
  const b64 = window
    .btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64;
}

export function decodeValues(encoded: string): Record<string, unknown> {
  const pad = encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  let json: string;
  if (typeof window === "undefined") {
    json = Buffer.from(b64, "base64").toString("utf-8");
  } else {
    json = decodeURIComponent(escape(window.atob(b64)));
  }
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Validate slug format. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/.test(slug);
}

/** Convert "Master React in 30 days" → "master-react-in-30-days". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Returns true when every required field has a non-empty value. */
export function isComplete(
  def: TemplateDefinition,
  values: Record<string, unknown>,
): boolean {
  for (const section of def.sections) {
    for (const field of section.fields) {
      const v = values[field.key];
      if (v === undefined || v === null) return false;
      if (typeof v === "string" && v.trim() === "" && field.type !== "color") {
        return false;
      }
    }
  }
  return true;
}

/** Build a per-field utility: type → control style hint. Used by FieldEditor. */
export function defaultPlaceholder(field: FieldConfig): string {
  if (field.placeholder) return field.placeholder;
  switch (field.type) {
    case "text":
      return "Type here…";
    case "textarea":
      return "Tell your story…";
    case "image":
      return "https://…";
    case "color":
      return "#000000";
    case "number":
      return "0";
    default:
      return "";
  }
}
