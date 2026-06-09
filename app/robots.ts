import type { MetadataRoute } from "next";

// Allow crawlers on public storefront/marketing pages; keep private app areas
// (dashboard, admin, API, internal account/order/checkout) out of the index.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  return {
    sitemap: `${base}/sitemap.xml`,
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/api/",
        "/account",
        "/order/",
        "/unlock/",
        "/download/",
        "/p/", // checkout pages — not meant to be indexed directly
        "/seller-host/", // internal rewrite target
      ],
    },
  };
}
