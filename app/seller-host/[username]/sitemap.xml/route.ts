// Per-seller storefront sitemap. On a seller subdomain / custom domain the
// middleware rewrites GET /sitemap.xml → /seller-host/<username>/sitemap.xml,
// so this handler sees the seller handle as params.username and the original
// branded host in the request headers. Lists the indexable storefront surface:
// the home, published landing + lead-magnet pages, and the store/course hubs
// when populated. Payment (/p) and Telegram (/tg) checkout pages are
// intentionally excluded to match robots.ts.

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicPagePath } from "@/lib/page-url";

export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET(
  _req: Request,
  { params }: { params: { username: string } },
) {
  const h = headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "")
    .split(":")[0]
    .trim();
  const proto = h.get("x-forwarded-proto") || "https";
  const base = host ? `${proto}://${host}` : "";

  const urls = new Set<string>();
  if (base) urls.add(`${base}/`);

  if (base) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("subdomain", params.username)
      .maybeSingle();
    const ownerId = profile?.id;

    if (ownerId) {
      // Published landing + lead-magnet pages.
      const { data: pages } = await admin
        .from("pages")
        .select("slug, type, template_id")
        .eq("user_id", ownerId)
        .in("type", ["landing", "lead_magnet"])
        .eq("status", "published");
      for (const p of (pages ?? []) as Array<{
        slug: string;
        type: string | null;
        template_id: string | null;
      }>) {
        urls.add(`${base}${publicPagePath(p.type, p.slug, p.template_id)}`);
      }

      // Store hub — only when there's at least one published catalog product.
      const { data: prod } = await admin
        .from("products")
        .select("id, pages!products_page_id_fkey(status)")
        .eq("user_id", ownerId)
        .eq("is_catalog", true)
        .eq("active", true)
        .limit(50);
      const hasStore = ((prod ?? []) as Array<{ pages: unknown }>).some((p) => {
        const pg = Array.isArray(p.pages) ? p.pages[0] : p.pages;
        return (pg as { status?: string } | null)?.status === "published";
      });
      if (hasStore) urls.add(`${base}/store`);

      // Course hub — only when at least one course is published.
      const { count: courseCount } = await admin
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("seller_user_id", ownerId)
        .eq("status", "published");
      if ((courseCount ?? 0) > 0) urls.add(`${base}/course`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
