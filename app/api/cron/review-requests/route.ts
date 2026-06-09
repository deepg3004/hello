// POST or GET /api/cron/review-requests
//
// Auth: requires `x-cron-secret: $CRON_SECRET`.
//
// Asks buyers for a review a few days after purchase — the single highest-
// leverage trust asset, and nothing prompted it before. One pass:
//   • find paid orders with a reviewable product, paid 3–7 days ago, that we
//     haven't already asked (orders.review_requested_at is null);
//   • email the buyer a link to the product's storefront page (where the
//     verified-buyer Reviews section lives) from the seller's brand;
//   • stamp review_requested_at so each order is asked at most once.
//
// The 7-day lower bound stops the first run from emailing very old orders.
//
// Wire from VPS system cron (mirror discord/telegram expiries):
//   0 9 * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
//             https://app.invoxai.io/api/cron/review-requests

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { SHELL } from "@/lib/emails/layout";
import { platformRootDomain } from "@/lib/domains";

export const dynamic = "force-dynamic";

const BATCH = 200;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // dev convenience
  const got = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface OrderRow {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  seller_user_id: string;
  product_id: string | null;
  products: { name: string; page_id: string | null } | { name: string; page_id: string | null }[] | null;
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const olderThan = new Date(now - 3 * 86400_000).toISOString();
  const newerThan = new Date(now - 7 * 86400_000).toISOString();

  const { data: rows, error } = await admin
    .from("orders")
    .select(
      "id, buyer_email, buyer_name, seller_user_id, product_id, products!orders_product_id_fkey(name, page_id)",
    )
    .eq("status", "paid")
    .is("review_requested_at", null)
    .not("product_id", "is", null)
    .lte("paid_at", olderThan)
    .gte("paid_at", newerThan)
    .limit(BATCH);
  if (error) {
    console.error("[review-requests] query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (rows ?? []) as unknown as OrderRow[];
  if (orders.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Resolve seller subdomains + the product's page slug in two small queries.
  const sellerIds = [...new Set(orders.map((o) => o.seller_user_id))];
  const pageIds = [
    ...new Set(
      orders
        .map((o) => {
          const p = Array.isArray(o.products) ? o.products[0] : o.products;
          return p?.page_id ?? null;
        })
        .filter((x): x is string => !!x),
    ),
  ];
  const [{ data: sellers }, { data: pages }] = await Promise.all([
    admin.from("user_profiles").select("id, subdomain, full_name, legal_business_name").in("id", sellerIds),
    pageIds.length
      ? admin.from("pages").select("id, slug").in("id", pageIds)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ]);
  const subBy = new Map(
    (sellers ?? []).map((s) => [
      s.id,
      {
        sub: s.subdomain as string | null,
        name: (s.legal_business_name as string | null) || (s.full_name as string | null) || "the store",
      },
    ]),
  );
  const slugBy = new Map((pages ?? []).map((p) => [p.id, p.slug as string]));
  const root = platformRootDomain();

  let sent = 0;
  for (const o of orders) {
    const prod = Array.isArray(o.products) ? o.products[0] : o.products;
    const seller = subBy.get(o.seller_user_id);
    const slug = prod?.page_id ? slugBy.get(prod.page_id) : null;
    const origin = seller?.sub ? `https://${seller.sub}.${root}` : `https://app.${root}`;
    const reviewUrl = slug ? `${origin}/store/${slug}` : `${origin}/store`;
    const productName = prod?.name ?? "your purchase";
    const hi = o.buyer_name ? `Hi ${o.buyer_name},` : "Hi,";

    try {
      await sendEmail({
        to: o.buyer_email,
        role: "buyer",
        sellerId: o.seller_user_id,
        subject: `How was ${productName}? Leave a quick review`,
        html: SHELL(
          `<h2 style="margin:0 0 12px;font-size:20px">How was ${productName}? ⭐</h2>
           <p>${hi}</p>
           <p>Thanks for buying from ${seller?.name ?? "the store"}. If you have a moment,
              a short review really helps other buyers — and the creator.</p>
           <p style="margin:20px 0">
             <a href="${reviewUrl}#reviews" style="display:inline-block;background:#2563eb;color:#fff;
                text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:600">
               Leave a review
             </a>
           </p>
           <p style="font-size:13px;color:#6b7280">You'll be asked to sign in with the email you
              purchased with, so your review shows as a verified buyer.</p>`,
          { preheader: `Leave a review for ${productName}` },
        ),
      });
      sent++;
    } catch (e) {
      console.error("[review-requests] email failed for order", o.id, e);
    }

    // Stamp regardless of email outcome so a hard-bouncing address isn't retried
    // forever (best-effort, mirrors the recovery/expiry crons).
    await admin
      .from("orders")
      .update({ review_requested_at: new Date().toISOString() })
      .eq("id", o.id);
  }

  return NextResponse.json({ ok: true, sent, scanned: orders.length });
}
