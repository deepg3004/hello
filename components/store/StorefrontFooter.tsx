import { LEGAL_DOCS, type ChromeConfig } from "@/lib/storefront-theme";
import { withStorefrontBase } from "@/lib/storefront-base";

/** Themed storefront footer — link columns, social links, a legal row
 *  (privacy/terms/refund/contact + Powered by InvoxAI), and a copyright line. */
export function StorefrontFooter({
  footer,
  brandName,
  basePath = "",
}: {
  footer: ChromeConfig["footer"];
  brandName: string;
  basePath?: string;
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
                      <a href={withStorefrontBase(basePath, l.url)} className="sf-muted text-sm transition hover:opacity-80">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {/* Legal row */}
        <div className="sf-border flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5 text-xs">
          {LEGAL_DOCS.map((d) => (
            <a key={d.key} href={withStorefrontBase(basePath, `/legal/${d.key}`)} className="sf-muted transition hover:opacity-80">
              {d.label}
            </a>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="sf-muted text-xs">{text}</p>
          <a href="https://invoxai.io" target="_blank" rel="noreferrer" className="sf-muted text-xs transition hover:opacity-80">
            Powered by InvoxAI
          </a>
        </div>
      </div>
    </footer>
  );
}
