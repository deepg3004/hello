import { tgTheme } from "@/lib/telegram-themes";
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
    <div className="relative min-h-screen" style={{ background: theme.bg }}>
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
              <div key={b.id ?? i}>
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
