import { themeCssVars, type SurfaceConfig } from "@/lib/storefront-theme";

/** Wraps a store/course surface: applies the theme's CSS variables + font, an
 *  optional announcement bar, and the themed page background. */
export function StorefrontShell({
  cfg,
  children,
}: {
  cfg: SurfaceConfig;
  children: React.ReactNode;
}) {
  const vars = themeCssVars(cfg);
  const showBar = cfg.sections.announcement && !!cfg.announcement.trim();
  return (
    <div className="sf-root min-h-screen" style={vars as React.CSSProperties}>
      {showBar && (
        <div className="sf-accent-bg w-full px-4 py-2 text-center text-xs font-medium tracking-wide">
          {cfg.announcement}
        </div>
      )}
      {children}
    </div>
  );
}

/** A themed promo banner (catalog hero strip). Renders nothing when disabled. */
export function PromoBanner({ cfg }: { cfg: SurfaceConfig }) {
  if (!cfg.sections.promo || !cfg.promoTitle.trim()) return null;
  return (
    <div className="sf-card mb-8 overflow-hidden p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="sf-display text-xl font-bold sm:text-2xl">{cfg.promoTitle}</h2>
          {cfg.promoText && <p className="sf-muted mt-1 text-sm">{cfg.promoText}</p>}
        </div>
        {cfg.promoCtaLabel && cfg.promoCtaUrl && (
          <a href={cfg.promoCtaUrl} className="sf-btn px-5 py-2.5 text-sm font-semibold">
            {cfg.promoCtaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
