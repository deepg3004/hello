"use client";

import { useState } from "react";

/** Shopify-style image gallery: large main image + thumbnail strip. */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = images.length > 0 ? images : [];
  const [active, setActive] = useState(0);

  if (list.length === 0) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100" />
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-square w-full overflow-hidden rounded-2xl border bg-zinc-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={list[active]} alt={alt} className="h-full w-full object-cover" />
      </div>
      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={
                "h-16 w-16 overflow-hidden rounded-lg border-2 transition " +
                (i === active ? "border-primary" : "border-transparent hover:border-zinc-300")
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${alt} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
