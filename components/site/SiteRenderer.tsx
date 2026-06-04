// Renders a seller website page (site_pages.blocks) on the subdomain / custom
// domain: a top nav built from the seller's published pages, the ordered content
// blocks (reusing the shared BLOCKS registry), and a footer. Theming is via CSS
// variables set on the wrapper (see lib/site-themes), so blocks work in any
// palette. Server component.

import Link from "next/link";

import { BLOCKS, type SiteProductLite } from "@/components/templates/blocks/registry";
import { SiteNav } from "@/components/site/SiteNav";
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

export interface SiteNavPage {
  slug: string;
  label: string;
  isHome: boolean;
}

export function SiteRenderer(props: {
  blocks: unknown;
  themeKey?: string | null;
  fontKey?: string | null;
  brandColor?: string | null;
  seller: { name: string; avatar: string | null };
  socialLinks?: Record<string, string> | null;
  tagline?: string | null;
  footerText?: string | null;
  footerLinks?: Array<{ label: string; url: string }>;
  footerColumns?: Array<{ title: string; links: Array<{ label: string; url: string }> }>;
  products?: SiteProductLite[];
  navPages?: SiteNavPage[];
  /** Current page slug; undefined on the home page. */
  currentSlug?: string;
  isPreview?: boolean;
}) {
  const theme = getSiteTheme(props.themeKey);
  const accent = props.brandColor || theme.accent;
  const blocks = Array.isArray(props.blocks) ? (props.blocks as Block[]) : [];
  const nav = props.navPages ?? [];
  const fontStack = siteFontStack(props.fontKey);
  const rootStyle = { ...siteThemeStyle(theme, props.brandColor), ...(fontStack ? { fontFamily: fontStack } : {}) };

  return (
    <div className="relative min-h-screen" style={rootStyle}>
      <div className="flex min-h-screen flex-col">
        {/* Top navigation (responsive — hamburger on mobile) */}
        <SiteNav
          seller={props.seller}
          navPages={nav}
          accent={accent}
          currentSlug={props.currentSlug}
        />

        {/* Content blocks */}
        <main className="flex-1">
          {blocks.length === 0 ? (
            <div className="mx-auto max-w-md px-4 py-28 text-center">
              <p className="font-sora text-lg font-semibold text-[color:var(--s-fg)]">
                Nothing here yet
              </p>
              <p className="mt-1 text-sm text-[color:var(--s-fg-dim)]">
                Add sections in your dashboard to build this page.
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
                    slug: props.currentSlug,
                    isPreview: props.isPreview,
                    products: props.products,
                    seller: props.seller,
                    socialLinks: props.socialLinks,
                  })}
                </div>
              );
            })
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[color:var(--s-border)] px-4 py-10">
          {(props.footerColumns?.length ?? 0) > 0 && (
            <div className="mx-auto mb-8 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {props.footerColumns!.map((col, ci) => (
                <div key={ci}>
                  {col.title && (
                    <p className="mb-2 text-sm font-semibold text-[color:var(--s-fg)]">
                      {col.title}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {col.links.map((l, li) => (
                      <li key={li}>
                        <a
                          href={/^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`}
                          className="text-sm text-[color:var(--s-fg-dim)] transition hover:text-[color:var(--s-fg)]"
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <div className="text-center">
          {props.tagline && (
            <p className="text-sm text-[color:var(--s-fg-muted)]">{props.tagline}</p>
          )}
          {(nav.length > 0 || (props.footerLinks?.length ?? 0) > 0) && (
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
              {nav.map((p) => (
                <Link
                  key={p.slug}
                  href={p.isHome ? "/" : `/${p.slug}`}
                  className="text-[color:var(--s-fg-dim)] transition hover:text-[color:var(--s-fg)]"
                >
                  {p.label}
                </Link>
              ))}
              {(props.footerLinks ?? []).map((l, i) => (
                <a
                  key={`f${i}`}
                  href={/^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--s-fg-dim)] transition hover:text-[color:var(--s-fg)]"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}
          {props.footerText && (
            <p className="mt-3 text-xs text-[color:var(--s-fg-dim)]">{props.footerText}</p>
          )}
          <p className="mt-5 text-xs text-[color:var(--s-fg-dim)]">
            © {props.seller.name} · Powered by{" "}
            <span className="font-sora font-semibold text-[color:var(--s-fg-muted)]">
              InvoxAI
            </span>
          </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
