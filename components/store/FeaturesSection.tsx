import { mdLite } from "@/lib/md-lite";
import type { Feature } from "@/lib/storefront-theme";
import { FEATURE_ICON_MAP } from "@/components/store/featureIcons";

/** Icon/image + title + text grid (e.g. "Free shipping · Secure · 24/7 support"). */
export function FeaturesSection({
  items,
  align = "left",
}: {
  items: Feature[];
  align?: "left" | "center";
}) {
  if (!items.length) return null;
  const cols = items.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const alignCls = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <section className="mt-14">
      <div className={`grid gap-5 ${cols}`}>
        {items.map((f, i) => {
          const Icon = f.icon ? FEATURE_ICON_MAP[f.icon] : null;
          return (
            <div key={i} className={`sf-card flex flex-col gap-2 p-5 ${alignCls}`}>
              {f.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image} alt="" className="h-10 w-10 rounded object-cover" />
              ) : Icon ? (
                <span className="sf-accent-bg flex h-10 w-10 items-center justify-center rounded-full">
                  <Icon className="h-5 w-5" />
                </span>
              ) : null}
              {f.title && <p className="sf-display font-semibold">{f.title}</p>}
              {f.text && (
                <div className="sf-muted text-sm leading-relaxed [&_a]:text-[color:var(--sf-accent)]" dangerouslySetInnerHTML={{ __html: mdLite(f.text) }} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
