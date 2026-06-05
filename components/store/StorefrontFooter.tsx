import type { ChromeConfig } from "@/lib/storefront-theme";

/** Themed storefront footer — link columns, social links, and a copyright line. */
export function StorefrontFooter({
  footer,
  brandName,
}: {
  footer: ChromeConfig["footer"];
  brandName: string;
}) {
  const text = footer.text.trim() || `© ${brandName}. All rights reserved.`;
  const hasColumns = footer.columns.length > 0;
  const hasSocials = footer.socials.length > 0;

  return (
    <footer className="sf-band sf-border mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {(hasColumns || hasSocials) && (
          <div className="mb-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <p className="sf-display text-lg font-bold">{brandName}</p>
              {hasSocials && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {footer.socials.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer" className="sf-muted text-sm transition hover:opacity-80">
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {footer.columns.map((col, i) => (
              <div key={i}>
                <p className="mb-2 text-sm font-semibold">{col.title}</p>
                <ul className="space-y-1.5">
                  {col.links.map((l, j) => (
                    <li key={j}>
                      <a href={l.url} className="sf-muted text-sm transition hover:opacity-80">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="sf-muted text-xs">{text}</p>
      </div>
    </footer>
  );
}
