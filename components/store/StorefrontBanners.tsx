"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Banner, Align } from "@/lib/storefront-theme";

const ALIGN: Record<Align, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

/** Seller-built banners shown at the top of a catalog (replaces the hero).
 *  Multiple banners auto-slide as a carousel; each has its own alignment. */
export function StorefrontBanners({
  banners,
  autoplay = true,
}: {
  banners: Banner[];
  autoplay?: boolean;
}) {
  const [i, setI] = useState(0);
  const n = banners.length;

  useEffect(() => {
    if (!autoplay || n <= 1) return;
    const id = setInterval(() => setI((p) => (p + 1) % n), 5000);
    return () => clearInterval(id);
  }, [autoplay, n]);

  if (n === 0) return null;
  const go = (d: number) => setI((p) => (p + d + n) % n);

  return (
    <div className="relative mb-8 overflow-hidden rounded-[var(--sf-radius)]">
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, idx) => (
          <div key={idx} className="w-full shrink-0 grow-0 basis-full">
            <BannerSlide banner={b} />
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Go to banner ${idx + 1}`}
                className={"h-2 rounded-full transition-all " + (idx === i ? "w-5 bg-white" : "w-2 bg-white/60")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BannerSlide({ banner: b }: { banner: Banner }) {
  const align = ALIGN[b.align] ?? ALIGN.left;
  const cta =
    b.ctaLabel && b.ctaUrl ? (
      <a href={b.ctaUrl} className="sf-btn mt-3 inline-block px-5 py-2.5 text-sm font-semibold">
        {b.ctaLabel}
      </a>
    ) : null;

  if (b.type === "image" && b.image) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.image} alt={b.title || "Banner"} className="h-44 w-full object-cover sm:h-72" />
        {(b.title || b.subtitle || cta) && (
          <div className={`absolute inset-0 flex flex-col justify-center gap-1.5 bg-gradient-to-r from-black/55 to-black/10 p-6 text-white sm:p-12 ${align}`}>
            {b.title && <h2 className="sf-display max-w-lg text-2xl font-bold sm:text-4xl">{b.title}</h2>}
            {b.subtitle && <p className="max-w-md text-sm text-white/85 sm:text-base">{b.subtitle}</p>}
            {cta}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`sf-card flex flex-col justify-center gap-2 p-8 sm:p-14 ${align}`}>
      {b.title && <h2 className="sf-display text-2xl font-bold sm:text-4xl">{b.title}</h2>}
      {b.subtitle && <p className="sf-muted max-w-xl text-sm sm:text-base">{b.subtitle}</p>}
      {cta}
    </div>
  );
}
