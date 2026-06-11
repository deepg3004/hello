import Link from "next/link";
import { Zap } from "lucide-react";

/** Sticky frosted-glass top nav for the marketing site. */
export function MarketingNav({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string;
}) {
  return (
    <header className="sticky top-0 z-50">
      <div className="glass border-b">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient shadow-sm shadow-black/20">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
              ) : (
                <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
              )}
            </span>
            <span className="font-sora text-base font-semibold tracking-tight">
              {name}
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
          </div>
        </nav>
      </div>
    </header>
  );
}
