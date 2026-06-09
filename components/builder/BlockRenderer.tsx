"use client";

// Shared renderer: turns a BuilderDocument JSON tree into React, applying each
// widget's per-device style and framer-motion entrance animation. Used by the
// editor Preview and (Phase 6) the public page, so what the seller builds is
// what visitors see. `device` selects which responsive style values to resolve.

import { motion } from "framer-motion";

import { widgetDef } from "@/lib/builder/widget-registry";
import { resolveStyle, toCss, ANIMATIONS, type ResponsiveStyle } from "@/lib/builder/style";
import { BuilderContextProvider } from "@/components/builder/BuilderContext";
import type { BuilderDocument, Device, WidgetNode } from "@/lib/builder/types";

function RenderedWidget({ w, device }: { w: WidgetNode; device: Device }) {
  const def = widgetDef(w.type);
  if (!def) return null;
  const resolved = resolveStyle(w.style as ResponsiveStyle | undefined, device);
  if (resolved.hidden) return null; // hidden on this device

  const anim = ANIMATIONS[w.animation ?? "none"] ?? ANIMATIONS.none;
  const animated = (w.animation ?? "none") !== "none";

  return (
    <motion.div
      style={toCss(resolved)}
      {...(animated
        ? {
            initial: anim.initial,
            whileInView: anim.animate,
            viewport: { once: true, amount: 0.3 },
            transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
          }
        : {})}
    >
      {def.Render(w.content ?? {})}
    </motion.div>
  );
}

export function BlockRenderer({
  doc,
  device = "desktop",
  siteId,
  preview = false,
}: {
  doc: BuilderDocument;
  device?: Device;
  /** Lets interactive widgets (form/buy) resolve the site server-side. */
  siteId?: string;
  /** True in the editor preview — interactive widgets mock their action. */
  preview?: boolean;
}) {
  return (
    <BuilderContextProvider value={{ siteId, preview }}>
      {doc.sections.map((section) => (
        <section key={section.id} className="w-full px-4 py-8">
          <div
            className={`mx-auto flex w-full max-w-5xl gap-6 ${
              device === "mobile" ? "flex-col" : "flex-col md:flex-row md:items-stretch"
            }`}
          >
            {section.columns.map((col) => (
              <div
                key={col.id}
                className="flex min-w-0 flex-1 flex-col gap-4"
                style={{ flexBasis: `${col.width}%` }}
              >
                {col.widgets.map((w) => (
                  <RenderedWidget key={w.id} w={w} device={device} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </BuilderContextProvider>
  );
}
