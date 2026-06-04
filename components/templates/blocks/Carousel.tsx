"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Slide {
  image: string;
  caption?: string;
  url?: string;
}

/** Lightweight auto-playing image carousel — no dependencies. */
export function Carousel({
  slides,
  autoplay = true,
  intervalMs = 4000,
  accent = "#6366f1",
}: {
  slides: Slide[];
  autoplay?: boolean;
  intervalMs?: number;
  accent?: string;
}) {
  const [i, setI] = useState(0);
  const n = slides.length;

  useEffect(() => {
    if (!autoplay || n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), Math.max(1500, intervalMs));
    return () => clearInterval(t);
  }, [autoplay, intervalMs, n]);

  if (n === 0) return null;
  const go = (d: number) => setI((p) => (p + d + n) % n);

  return (
    <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl ring-1 ring-[color:var(--s-border)]">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {slides.map((s, idx) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.image}
              alt={s.caption ?? ""}
              className="h-full w-full shrink-0 object-cover"
            />
          );
          return (
            <div key={idx} className="relative aspect-video w-full shrink-0 bg-black/10">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="block h-full w-full">
                  {img}
                </a>
              ) : (
                img
              )}
              {s.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-sm font-medium text-white">
                  {s.caption}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className="h-2 w-2 rounded-full transition"
                style={{
                  background: idx === i ? accent : "rgba(255,255,255,0.6)",
                  transform: idx === i ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
