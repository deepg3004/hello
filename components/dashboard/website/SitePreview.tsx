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
  onEditBlock,
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
  /** Commit an in-canvas edit to a block's data (by id). */
  onEditBlock?: (id: string, data: Record<string, unknown>) => void;
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
          const selected = interactive && selectedId === id;
          // The selected block becomes editable (text blocks render inline
          // contentEditable and commit on blur via onEditBlock).
          const editable = !!selected && typeof onEditBlock === "function";
          const rendered = def.Render(b.data ?? {}, {
            accent,
            isPreview: true,
            products,
            seller,
            socialLinks,
            editable,
            onEditField: editable
              ? (k, v) => onEditBlock!(id, { ...(b.data ?? {}), [k]: v })
              : undefined,
            onEditItem: editable
              ? (listKey, index, subKey, v) => {
                  const data = b.data ?? {};
                  const listRaw = data[listKey];
                  const listArr = Array.isArray(listRaw)
                    ? [...(listRaw as Array<Record<string, unknown>>)]
                    : [];
                  listArr[index] = { ...(listArr[index] ?? {}), [subKey]: v };
                  onEditBlock!(id, { ...data, [listKey]: listArr });
                }
              : undefined,
          });
          if (!interactive) {
            return (
              <div key={id} style={sectionBgStyle(b.data?._bg, accent)}>
                {rendered}
              </div>
            );
          }
          return (
            <div
              key={id}
              onClick={() => onSelect?.(id)}
              style={sectionBgStyle(b.data?._bg, accent)}
              className={`group relative cursor-pointer outline-offset-[-2px] transition ${
                selected
                  ? "outline outline-2 outline-indigo-500"
                  : "hover:outline hover:outline-2 hover:outline-indigo-300"
              }`}
            >
              <span
                className={`absolute left-2 top-2 z-10 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                  selected ? "" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {def.label}
                {selected ? " · click text to edit" : ""}
              </span>
              {/* Non-selected sections are non-interactive so clicks select them;
                  the selected section is interactive so its text is editable.
                  In the selected section we block link/button navigation so the
                  editor doesn't navigate away while you edit. */}
              <div
                className={selected ? "" : "pointer-events-none"}
                onClick={
                  selected
                    ? (e) => {
                        if ((e.target as HTMLElement).closest("a,button")) {
                          e.preventDefault();
                        }
                      }
                    : undefined
                }
              >
                {rendered}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
