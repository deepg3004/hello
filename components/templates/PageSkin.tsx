// Global "design skin" applied around every rendered template. It reads a few
// page_config keys set in the editor's Design step and applies them across the
// WHOLE page via scoped CSS — so the controls work on every template without
// each one having to opt in:
//   - page_font   → font family (scoped !important so it beats font-sora etc.)
//   - corner_style→ button / input / link corner radius
//   - page_scale  → root font-size (scales all rem-based text + spacing)
//   - accent_color→ exposed as the --ix-accent CSS variable
//
// Used on the public page and in the /preview iframe so the live preview
// matches the published page.

import type { CSSProperties, ReactNode } from "react";

export const SKIN_FONTS: Record<
  string,
  { label: string; stack: string; google?: string }
> = {
  default: { label: "Default", stack: "" },
  inter: {
    label: "Inter",
    stack: "'Inter', system-ui, sans-serif",
    google: "Inter:wght@400;500;600;700",
  },
  poppins: {
    label: "Poppins",
    stack: "'Poppins', system-ui, sans-serif",
    google: "Poppins:wght@400;500;600;700",
  },
  sora: {
    label: "Sora",
    stack: "'Sora', system-ui, sans-serif",
    google: "Sora:wght@400;600;700",
  },
  playfair: {
    label: "Playfair (serif)",
    stack: "'Playfair Display', Georgia, serif",
    google: "Playfair+Display:wght@500;600;700",
  },
  lora: {
    label: "Lora (serif)",
    stack: "'Lora', Georgia, serif",
    google: "Lora:wght@400;500;600",
  },
  mono: { label: "Mono", stack: "ui-monospace, Menlo, monospace" },
};

export const SKIN_CORNERS: Record<string, { label: string; radius: string | null }> = {
  default: { label: "Default", radius: null },
  sharp: { label: "Sharp", radius: "2px" },
  rounded: { label: "Rounded", radius: "0.85rem" },
  pill: { label: "Pill", radius: "9999px" },
};

export const SKIN_SCALES: Record<string, { label: string; px: string | null }> = {
  compact: { label: "Compact", px: "15px" },
  default: { label: "Default", px: null },
  comfortable: { label: "Comfortable", px: "17px" },
  large: { label: "Large", px: "18px" },
};

const SKIN_ID = "ix-skin";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function PageSkin({
  values,
  children,
}: {
  values: Record<string, unknown>;
  children: ReactNode;
}) {
  const font = SKIN_FONTS[str(values.page_font)] ?? SKIN_FONTS.default;
  const corner = SKIN_CORNERS[str(values.corner_style)] ?? SKIN_CORNERS.default;
  const scale = SKIN_SCALES[str(values.page_scale)] ?? SKIN_SCALES.default;
  const accent = str(values.accent_color).trim();

  const rules: string[] = [];
  if (font.stack) {
    rules.push(`#${SKIN_ID}, #${SKIN_ID} *{font-family:${font.stack} !important}`);
  }
  if (corner.radius != null) {
    rules.push(
      `#${SKIN_ID} button, #${SKIN_ID} a[href], #${SKIN_ID} input, #${SKIN_ID} textarea, #${SKIN_ID} select{border-radius:${corner.radius} !important}`,
    );
  }
  if (scale.px) {
    // Scales every rem-based size on the standalone page (and the preview
    // iframe, which is its own document).
    rules.push(`:root{font-size:${scale.px}}`);
  }
  const css = rules.join("\n");

  return (
    <div
      id={SKIN_ID}
      style={accent ? ({ ["--ix-accent"]: accent } as CSSProperties) : undefined}
    >
      {font.google && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${font.google}&display=swap`}
        />
      )}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
    </div>
  );
}
