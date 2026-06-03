// App download / waitlist — definition + adapter.

import { AppDownloadPage } from "@/components/templates/AppDownloadPage";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "app-download",
  name: "App Download",
  description:
    "Mobile app download / waitlist page — two-column hero with store badges + phone mockup, features grid, testimonial, and an email-capture for the download link.",
  category: "landing",
  dbType: "landing",
  thumbnail: "",
  theme: { name: "Telegram Blue", primary: "#29b6f6", background: "#00344f" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        { key: "hero_eyebrow", label: "Eyebrow", type: "text", defaultValue: "Now available on iOS & Android" },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "The app your day has been missing",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "Everything in one tap — fast, beautiful, and built for your pocket. Download free and get started in seconds.",
        },
        { key: "hero_cta", label: "Hero button label", type: "text", defaultValue: "Get the app" },
        { key: "appstore_caption", label: "App Store — top caption", type: "text", defaultValue: "Download on the" },
        { key: "appstore_label", label: "App Store — main label", type: "text", defaultValue: "App Store" },
        { key: "googleplay_caption", label: "Google Play — top caption", type: "text", defaultValue: "Get it on" },
        { key: "googleplay_label", label: "Google Play — main label", type: "text", defaultValue: "Google Play" },
        { key: "rating_value", label: "Rating value", type: "text", defaultValue: "4.9" },
        { key: "rating_caption", label: "Rating caption", type: "text", defaultValue: "· 12k reviews" },
      ],
    },
    {
      id: "phone",
      label: "Phone mockup",
      type: "hero",
      fields: [
        {
          key: "screenshot_url",
          label: "App screenshot",
          type: "image",
          defaultValue: "",
          hint: "Shown inside the phone frame. Leave empty for an accent-tinted placeholder screen.",
        },
        {
          key: "phone_caption",
          label: "Placeholder caption",
          type: "text",
          defaultValue: "Your app, beautifully in hand",
        },
      ],
    },
    {
      id: "features",
      label: "Features",
      type: "benefits",
      fields: [
        { key: "features_title", label: "Section title", type: "text", defaultValue: "Built for your pocket" },
        {
          key: "features_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Thoughtful, fast, and made to feel right the second you open it.",
        },
        {
          key: "features",
          label: "Feature cards",
          type: "list",
          itemLabel: "feature",
          minItems: 1,
          maxItems: 6,
          itemFields: [
            { key: "icon", label: "Icon (emoji, optional)", type: "text", defaultValue: "" },
            { key: "title", label: "Title", type: "text", defaultValue: "" },
            { key: "description", label: "Description", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            {
              icon: "⚡",
              title: "Blazing fast",
              description: "Opens instantly and stays snappy — no waiting, no lag.",
            },
            {
              icon: "🔔",
              title: "Smart notifications",
              description: "Get nudged only about what matters, exactly when it matters.",
            },
            {
              icon: "🔒",
              title: "Private by design",
              description: "Your data is encrypted and yours alone — always.",
            },
          ],
        },
      ],
    },
    {
      id: "testimonial",
      label: "Testimonial",
      type: "benefits",
      fields: [
        {
          key: "testimonial_quote",
          label: "Quote",
          type: "textarea",
          defaultValue: "I open this app more than any other on my phone. It just works, and it's gorgeous.",
        },
        { key: "testimonial_author", label: "Author name", type: "text", defaultValue: "Priya N." },
        { key: "testimonial_role", label: "Author role", type: "text", defaultValue: "Early user" },
      ],
    },
    {
      id: "capture",
      label: "Email capture",
      type: "form",
      category: "leads",
      fields: [
        { key: "capture_title", label: "Section title", type: "text", defaultValue: "Get the download link" },
        {
          key: "capture_subtitle",
          label: "Section subtitle",
          type: "textarea",
          defaultValue: "Drop your email and we'll send the download link straight to your inbox.",
        },
        { key: "capture_cta", label: "Button label", type: "text", defaultValue: "Send me the link" },
        {
          key: "capture_privacy",
          label: "Privacy line",
          type: "text",
          defaultValue: "We'll only email you about the app.",
        },
        {
          key: "redirect_url",
          label: "Redirect after submit (optional)",
          type: "text",
          defaultValue: "",
          hint: "e.g. a direct store link or a thank-you page.",
        },
      ],
    },
    {
      id: "advanced",
      label: "Conversion boosters",
      type: "advanced",
      fields: [
        { key: "sticky_cta", label: "Mobile sticky button label", type: "text", defaultValue: "Get the app" },
      ],
    },
    designSection("telegram"),
  ],
};

const Render: TemplateRender = ({ values, pageId, slug, product, products, isPreview, bumpRuntime }) => (
  <AppDownloadPage
    pageId={pageId}
    slug={slug}
    product={product}
    products={products}
    isPreview={isPreview}
    bumpRuntime={bumpRuntime}
    hero_eyebrow={readField(values, "hero_eyebrow", "")}
    hero_headline={readField(values, "hero_headline", "")}
    hero_subheadline={readField(values, "hero_subheadline", "")}
    hero_cta={readField(values, "hero_cta", "")}
    appstore_caption={readField(values, "appstore_caption", "")}
    appstore_label={readField(values, "appstore_label", "")}
    googleplay_caption={readField(values, "googleplay_caption", "")}
    googleplay_label={readField(values, "googleplay_label", "")}
    rating_value={readField(values, "rating_value", "")}
    rating_caption={readField(values, "rating_caption", "")}
    screenshot_url={readField(values, "screenshot_url", "") || undefined}
    phone_caption={readField(values, "phone_caption", "")}
    features_title={readField(values, "features_title", "")}
    features_subtitle={readField(values, "features_subtitle", "")}
    features={readField(values, "features", [])}
    testimonial_quote={readField(values, "testimonial_quote", "")}
    testimonial_author={readField(values, "testimonial_author", "")}
    testimonial_role={readField(values, "testimonial_role", "")}
    capture_title={readField(values, "capture_title", "")}
    capture_subtitle={readField(values, "capture_subtitle", "")}
    capture_cta={readField(values, "capture_cta", "")}
    capture_privacy={readField(values, "capture_privacy", "")}
    redirect_url={readField(values, "redirect_url", "") || undefined}
    sticky_cta={readField(values, "sticky_cta", "")}
    theme_key={readField(values, "theme", "telegram")}
    bg_animation={readField(values, "bg_animation", "none")}
    formConfig={(values.form_config as import("@/lib/leads").FormConfig | undefined) ?? undefined}
  />
);

export const appDownloadTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
