import Link from "next/link";

import { getBranding } from "@/lib/settings";

export default async function HomePage() {
  const branding = await getBranding();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          app.invoxai.io
        </p>
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="mx-auto mb-6 h-16 w-auto object-contain"
          />
        )}
        <h1 className="text-balance text-5xl font-sora font-semibold tracking-tight sm:text-6xl">
          {branding.name}
        </h1>
        <p className="mt-6 text-balance text-lg leading-8 text-muted-foreground">
          Payment pages, landing pages, and Telegram VIP access — built for
          creators and sellers. We collect, settle, and pay you fast.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Start free
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
