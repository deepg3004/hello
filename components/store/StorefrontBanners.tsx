import type { Banner } from "@/lib/storefront-theme";

/** Seller-built banners shown at the top of a catalog (replaces the hero).
 *  Image banners overlay title/subtitle/CTA; text banners are a themed panel. */
export function StorefrontBanners({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;
  return (
    <div className="mb-8 space-y-4">
      {banners.map((b, i) => {
        const cta =
          b.ctaLabel && b.ctaUrl ? (
            <a href={b.ctaUrl} className="sf-btn mt-3 inline-block px-5 py-2.5 text-sm font-semibold">
              {b.ctaLabel}
            </a>
          ) : null;

        if (b.type === "image" && b.image) {
          return (
            <div key={i} className="relative overflow-hidden rounded-[var(--sf-radius)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt={b.title || "Banner"} className="h-44 w-full object-cover sm:h-64" />
              {(b.title || b.subtitle || cta) && (
                <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/55 to-transparent p-6 text-white sm:p-10">
                  {b.title && <h2 className="sf-display max-w-lg text-2xl font-bold sm:text-3xl">{b.title}</h2>}
                  {b.subtitle && <p className="mt-1.5 max-w-md text-sm text-white/85 sm:text-base">{b.subtitle}</p>}
                  {cta}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={i} className="sf-card overflow-hidden p-6 text-center sm:p-10">
            {b.title && <h2 className="sf-display text-2xl font-bold sm:text-3xl">{b.title}</h2>}
            {b.subtitle && <p className="sf-muted mt-2 text-sm sm:text-base">{b.subtitle}</p>}
            {cta}
          </div>
        );
      })}
    </div>
  );
}
