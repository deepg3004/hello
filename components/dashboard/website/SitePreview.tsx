"use client";

import { BLOCKS, type SiteProductLite } from "@/components/templates/blocks/registry";
import {
  getSiteTheme,
  siteThemeStyle,
  sectionBgStyle,
  siteFontStack,
} from "@/lib/site-themes";

interface Block {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * Client-side live preview of a website page — renders the same BLOCKS as the
 * public site, themed, updating as the seller edits (before saving).
 */
export function SitePreview({
  blocks,
  theme,
  font,
  brandColor,
  seller,
  socialLinks,
  products,
}: {
  blocks: unknown;
  theme?: string | null;
  font?: string | null;
  brandColor?: string | null;
  seller: { name: string; avatar: string | null };
  socialLinks?: Record<string, string> | null;
  products?: SiteProductLite[];
}) {
  const t = getSiteTheme(theme);
  const accent = brandColor || t.accent;
  const list = Array.isArray(blocks) ? (blocks as Block[]) : [];
  const fontStack = siteFontStack(font);
  const rootStyle = {
    ...siteThemeStyle(t, brandColor),
    ...(fontStack ? { fontFamily: fontStack } : {}),
    minHeight: "100%",
  };

  return (
    <div style={rootStyle}>
      {list.length === 0 ? (
        <div className="px-4 py-20 text-center text-sm" style={{ color: t.fgDim }}>
          Add a section on the left to see it here.
        </div>
      ) : (
        list.map((b, i) => {
          const def = b && b.type ? BLOCKS[b.type] : undefined;
          if (!def) return null;
          return (
            <div key={b.id ?? i} style={sectionBgStyle(b.data?._bg, accent)}>
              {def.Render(b.data ?? {}, {
                accent,
                isPreview: true,
                products,
                seller,
                socialLinks,
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
