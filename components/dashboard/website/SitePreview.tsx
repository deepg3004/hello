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
  selectedId,
  onSelect,
}: {
  blocks: unknown;
  theme?: string | null;
  font?: string | null;
  brandColor?: string | null;
  seller: { name: string; avatar: string | null };
  socialLinks?: Record<string, string> | null;
  products?: SiteProductLite[];
  /** When set, clicking a section calls onSelect(blockId) and the section is
   *  outlined — used by the editor for click-to-edit. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const interactive = typeof onSelect === "function";
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
          const id = b.id ?? String(i);
          const rendered = def.Render(b.data ?? {}, {
            accent,
            isPreview: true,
            products,
            seller,
            socialLinks,
          });
          if (!interactive) {
            return (
              <div key={id} style={sectionBgStyle(b.data?._bg, accent)}>
                {rendered}
              </div>
            );
          }
          const selected = selectedId === id;
          return (
            <div
              key={id}
              onClick={() => onSelect?.(id)}
              style={sectionBgStyle(b.data?._bg, accent)}
              className={`group relative cursor-pointer outline-offset-[-2px] transition ${
                selected ? "outline outline-2 outline-indigo-500" : "hover:outline hover:outline-2 hover:outline-indigo-300"
              }`}
            >
              {/* Block label on hover/select */}
              <span
                className={`absolute left-2 top-2 z-10 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                  selected ? "" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {def.label}
              </span>
              {/* Inner content is non-interactive in the preview so clicks select. */}
              <div className="pointer-events-none">{rendered}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
