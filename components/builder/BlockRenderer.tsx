// Shared, pure renderer: turns a BuilderDocument JSON tree into React. Used by
// BOTH the public page (/u/[slug]) and the editor's Preview, so what the seller
// builds is exactly what visitors see. Server-safe (no client hooks).

import { widgetDef } from "@/lib/builder/widget-registry";
import type { BuilderDocument } from "@/lib/builder/types";

export function BlockRenderer({ doc }: { doc: BuilderDocument }) {
  return (
    <>
      {doc.sections.map((section) => (
        <section key={section.id} className="w-full px-4 py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:flex-row md:items-stretch">
            {section.columns.map((col) => (
              <div
                key={col.id}
                className="flex min-w-0 flex-1 flex-col gap-4"
                style={{ flexBasis: `${col.width}%` }}
              >
                {col.widgets.map((w) => {
                  const def = widgetDef(w.type);
                  if (!def) return null;
                  return <div key={w.id}>{def.Render(w.content ?? {}, w.style)}</div>;
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
