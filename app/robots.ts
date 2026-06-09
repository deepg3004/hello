import type { MetadataRoute } from "next";

// Allow crawlers on public storefront/marketing pages; keep private app areas
// (dashboard, admin, API, internal account/order/checkout) out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
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
