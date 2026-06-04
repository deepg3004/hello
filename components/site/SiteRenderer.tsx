// Renders a seller website page (site_pages.blocks) on the subdomain / custom
// domain: a top nav built from the seller's published pages, the ordered content
// blocks (reusing the shared BLOCKS registry), and a footer. Server component.

import Link from "next/link";

import { tgTheme } from "@/lib/telegram-themes";
import { BgAnimation } from "@/components/templates/BgAnimation";
import { BLOCKS, type SiteProductLite } from "@/components/templates/blocks/registry";

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
  themeKey?: string;
  bgAnimation?: string;
  brandColor?: string | null;
  seller: { name: string; avatar: string | null };
  socialLinks?: Record<string, string> | null;
  products?: SiteProductLite[];
  navPages?: SiteNavPage[];
  /** Current page slug; undefined on the home page. */
  currentSlug?: string;
  isPreview?: boolean;
}) {
  const theme = tgTheme(props.themeKey);
  const accent = props.brandColor || theme.accent;
  const blocks = Array.isArray(props.blocks) ? (props.blocks as Block[]) : [];
  const nav = props.navPages ?? [];

  return (
    <div className="relative min-h-screen" style={{ background: theme.bg }}>
      <BgAnimation type={props.bgAnimation} />
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top navigation */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-sora font-semibold text-white">
              {props.seller.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.seller.avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20"
                />
              )}
              <span className="truncate">{props.seller.name}</span>
            </Link>
            {nav.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {nav.map((p) => {
                  const isCurrent = p.isHome
                    ? !props.currentSlug
                    : props.currentSlug === p.slug;
                  return (
                    <Link
                      key={p.slug}
                      href={p.isHome ? "/" : `/${p.slug}`}
                      className="text-zinc-300 transition hover:text-white"
                      style={isCurrent ? { color: accent } : undefined}
                    >
                      {p.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </header>

        {/* Content blocks */}
        <main className="flex-1">
          {blocks.length === 0 ? (
            <div className="mx-auto max-w-md px-4 py-28 text-center">
              <p className="font-sora text-lg font-semibold text-white">
                Nothing here yet
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Add sections in your dashboard to build this page.
              </p>
            </div>
          ) : (
            blocks.map((b, i) => {
              const def = b && b.type ? BLOCKS[b.type] : undefined;
              if (!def) return null;
              return (
                <div key={b.id ?? i}>
                  {def.Render(b.data ?? {}, {
                    accent,
                    theme,
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
        <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-zinc-500">
          © {props.seller.name} · Powered by{" "}
          <span className="font-sora font-semibold text-zinc-300">InvoxAI</span>
        </footer>
      </div>
    </div>
  );
}
