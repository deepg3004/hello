import type { MetadataRoute } from "next";

// Marketing/platform-host sitemap (served on app.invoxai.io / the apex). Seller
// storefronts get their own per-host sitemap via
// app/seller-host/[username]/sitemap.xml/route.ts (the subdomain /sitemap.xml
// is rewritten there by middleware).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  const entries: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1 },
    { path: "/terms", priority: 0.4 },
    { path: "/privacy", priority: 0.4 },
    { path: "/refund", priority: 0.4 },
    { path: "/login", priority: 0.5 },
    { path: "/signup", priority: 0.6 },
  ];
  return entries.map((e) => ({
    url: `${base}${e.path}`,
    changeFrequency: "weekly",
    priority: e.priority,
  }));
}
