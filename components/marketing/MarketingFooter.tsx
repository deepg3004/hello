import { Zap } from "lucide-react";

/** Minimal marketing footer. */
export function MarketingFooter({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string;
}) {
  const year = 2026; // build-time constant; avoids client Date in a server file
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-brand-gradient">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            )}
          </span>
          <span className="font-sora text-sm font-semibold">{name}</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a href="#features" className="transition hover:text-foreground">Features</a>
          <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
        </nav>

        <p className="text-xs text-muted-foreground">
          © {year} {name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
