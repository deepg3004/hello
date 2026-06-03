// Shared "Design" section for every page template — exposes the colour theme
// and background animation pickers in the page builder. Backed by the same
// theme + animation data the Telegram VIP page uses, so all page types share
// one premium, themable look.

import { TG_THEMES, TG_ANIMATIONS } from "@/lib/telegram-themes";
import type { TemplateSection } from "@/lib/templates/types";

export const THEME_OPTIONS = Object.entries(TG_THEMES).map(([value, t]) => ({
  value,
  label: t.label,
}));

export const ANIM_OPTIONS = TG_ANIMATIONS.map((a) => ({
  value: a.key,
  label: a.label,
}));

/**
 * Builds the shared Design section. Pass a sensible default theme per template
 * (e.g. "midnight" for a navy course page) so existing pages keep a fitting
 * look until the seller picks their own.
 */
export function designSection(
  defaultTheme = "purple",
  defaultAnim = "none",
): TemplateSection {
  return {
    id: "design",
    label: "Design",
    type: "design",
    category: "landing",
    fields: [
      {
        key: "theme",
        label: "Colour theme",
        type: "select",
        options: THEME_OPTIONS,
        defaultValue: defaultTheme,
        hint: "Background + accent colour for the whole page.",
      },
      {
        key: "bg_animation",
        label: "Background animation",
        type: "select",
        options: ANIM_OPTIONS,
        defaultValue: defaultAnim,
        hint: "Optional ambient motion behind the page.",
      },
    ],
  };
}
