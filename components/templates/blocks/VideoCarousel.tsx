"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Video carousel — one embed at a time with prev/next + dots. No autoplay
 *  (autoplaying video with sound is poor UX). No dependencies. */
export function VideoCarousel({
  embeds,
  accent = "#6366f1",
}: {
  embeds: string[];
  accent?: string;
}) {
  const [i, setI] = useState(0);
  const n = embeds.length;
  if (n === 0) return null;
  const go = (d: number) => setI((p) => (p + d + n) % n);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-[color:var(--s-border)]">
        <iframe
          key={i}
          src={embeds[i]}
          title={`Video ${i + 1}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous video"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next video"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {embeds.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Video ${idx + 1}`}
              className="h-2 w-2 rounded-full transition"
              style={{
                background: idx === i ? accent : "var(--s-border)",
                transform: idx === i ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
