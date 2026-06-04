import type { CSSProperties } from "react";

import { tgTheme } from "@/lib/telegram-themes";
import { sectionBgStyle } from "@/lib/site-themes";
import { BgAnimation } from "@/components/templates/BgAnimation";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { BLOCKS } from "@/components/templates/blocks/registry";

interface Block {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
}

export function CustomBuilderPage(props: {
  pageId?: string;
  slug?: string;
  isPreview?: boolean;
  theme_key?: string;
  bg_animation?: string;
  blocks?: unknown;
}) {
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;
  const blocks = Array.isArray(props.blocks) ? (props.blocks as Block[]) : [];

  return (
    <div
      className="relative min-h-screen"
      style={
        {
          background: theme.bg,
          // Dark block CSS variables — keeps blocks (now var-themed) identical
          // to their previous hard-coded dark styling on custom/telegram pages.
          "--s-fg": "#ffffff",
          "--s-fg-muted": "#d4d4d8",
          "--s-fg-dim": "#a1a1aa",
          "--s-surface": "rgba(255,255,255,0.05)",
          "--s-border": "rgba(255,255,255,0.10)",
        } as CSSProperties
      }
    >
      <BgAnimation type={props.bg_animation} />
      <div className="relative z-10">
        {blocks.length === 0 ? (
          <div className="mx-auto max-w-md px-4 py-28 text-center">
            <p className="font-sora text-lg font-semibold text-white">
              Empty page
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Add blocks in the editor to build your page.
            </p>
          </div>
        ) : (
          blocks.map((b, i) => {
            const def = b && b.type ? BLOCKS[b.type] : undefined;
            if (!def) return null;
            return (
              <div key={b.id ?? i} style={sectionBgStyle(b.data?._bg, accent)}>
                {def.Render(b.data ?? {}, {
                  accent,
                  theme,
                  pageId: props.pageId,
                  slug: props.slug,
                  isPreview: props.isPreview,
                })}
              </div>
            );
          })
        )}
        <SecureFooter accent={accent} variant="lite" />
      </div>
    </div>
  );
}
