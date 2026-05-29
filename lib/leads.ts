// Shared types + helpers for the lead-capture + CRM system. Used by:
//   - components/pages/LeadCaptureForm.tsx
//   - components/dashboard/PageBuilder/FormBuilderTab.tsx
//   - app/api/leads/capture/route.ts
//   - lib/dashboard/queries.ts

export type CustomFieldType = "text" | "textarea" | "select" | "checkbox";

export interface CustomField {
  key: string;
  label: string;
  type: CustomFieldType;
  placeholder?: string;
  required?: boolean;
  /** Options for select type (one per line) — stored as array. */
  options?: string[];
}

export type PostSubmitAction = "thanks" | "redirect" | "download";

export interface FormConfig {
  /** Whether to render the name field (email is always rendered). */
  name_enabled?: boolean;
  /** Whether to render the phone field. */
  phone_enabled?: boolean;
  name_placeholder?: string;
  email_placeholder?: string;
  phone_placeholder?: string;
  custom_fields?: CustomField[];

  cta_text?: string;
  privacy_text?: string;

  /** What to do after a successful submit. */
  post_action?: PostSubmitAction;
  /** When post_action = redirect. */
  redirect_url?: string;
  /** When post_action = thanks (custom thank-you message). */
  thanks_text?: string;

  /** Optional Zapier/Make webhook — server POSTs the captured lead here. */
  webhook_url?: string;

  /** Auto-confirmation email to the lead. */
  confirmation_email_enabled?: boolean;
  confirmation_email_subject?: string;
  confirmation_email_body?: string;

  /** Email the seller every time a lead comes in. */
  notify_seller?: boolean;

  /** Tags auto-applied to every lead from this page. */
  auto_tags?: string[];
}

export interface LeadMagnetMeta {
  path: string;       // storage path: {user_id}/{page_id}/{filename}
  name: string;       // user-facing filename
  size?: number;
  mime?: string;
  uploaded_at?: string;
}

export const FORM_CONFIG_DEFAULTS: Required<
  Pick<FormConfig, "name_enabled" | "phone_enabled" | "cta_text" | "privacy_text" | "post_action" | "notify_seller">
> = {
  name_enabled: true,
  phone_enabled: false,
  cta_text: "Submit",
  privacy_text: "We respect your inbox. Unsubscribe anytime.",
  post_action: "thanks",
  notify_seller: true,
};

export function resolvedFormConfig(cfg?: FormConfig | null): FormConfig {
  return { ...FORM_CONFIG_DEFAULTS, ...(cfg ?? {}) };
}

export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const t = v.trim().toLowerCase().replace(/\s+/g, "-");
    if (t) out.add(t.slice(0, 32));
  }
  return Array.from(out).slice(0, 16);
}
