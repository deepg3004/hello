import { Stars } from "@/components/store/Stars";
import { mdLite } from "@/lib/md-lite";
import type { Testimonial } from "@/lib/storefront-theme";

/** Seller-curated testimonials grid (theme-aware, markdown-lite quotes). */
export function TestimonialsSection({
  items,
  title = "What customers say",
  align = "left",
}: {
  items: Testimonial[];
  title?: string;
  align?: "left" | "center";
}) {
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <h2 className={"sf-display mb-5 text-xl font-bold tracking-tight " + (align === "center" ? "text-center" : "")}>{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <div key={i} className="sf-card flex flex-col p-5">
            {t.rating > 0 && <Stars value={t.rating} size={14} />}
            {t.quote && (
              <div className="mt-2 flex-1 text-sm leading-relaxed [&_a]:text-[color:var(--sf-accent)]" dangerouslySetInnerHTML={{ __html: mdLite(t.quote) }} />
            )}
            <div className="mt-4 flex items-center gap-3">
              {t.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="sf-accent-bg flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
                  {(t.name?.[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                {t.name && <p className="truncate text-sm font-semibold">{t.name}</p>}
                {t.role && <p className="sf-muted truncate text-xs">{t.role}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
