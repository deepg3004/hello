// Digital-download delivery. After a paid order, grantDigitalDownloads() creates
// a download_grant per purchased digital product and emails the buyer their
// link(s). Files live in the PRIVATE `product-files` bucket and are served via
// short-lived signed URLs through /api/download/<token>, which enforces the
// per-buyer download limit atomically (consume_download_grant RPC).

import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";

import { APP_URL } from "@/lib/emails/layout";

type DB = SupabaseClient;

export const PFILE_PREFIX = "pfile:";
export const PRODUCT_FILES_BUCKET = "product-files";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Mint a short-lived signed URL for a `pfile:<path>` file, forcing a download
 *  with the original filename. Returns null if the reference isn't a private
 *  product file or signing fails. */
export async function signedDownloadUrl(
  fileUrl: string,
  fileName: string | null,
  admin: DB,
): Promise<string | null> {
  if (!fileUrl.startsWith(PFILE_PREFIX)) return null;
  const path = fileUrl.slice(PFILE_PREFIX.length);
  const { data, error } = await admin.storage
    .from(PRODUCT_FILES_BUCKET)
    .createSignedUrl(path, 120, { download: fileName || true });
  if (error || !data) return null;
  return data.signedUrl;
}

/** Create download grants for the digital products in a paid order and email
 *  the buyer their link(s). Idempotent per (order, product). Best-effort — the
 *  buyer is already paid, so this never throws into the caller. */
export async function grantDigitalDownloads(
  args: {
    orderId: string;
    sellerUserId: string;
    buyerEmail: string;
    productIds: string[];
  },
  admin: DB,
): Promise<void> {
  try {
    const email = args.buyerEmail?.trim().toLowerCase();
    const ids = Array.from(new Set(args.productIds.filter(Boolean)));
    if (!email || ids.length === 0) return;

    const { data: prods } = await admin
      .from("products")
      .select("id, name, file_url, file_name, download_limit, product_type")
      .in("id", ids);
    const digital = (prods ?? []).filter(
      (p) =>
        p.product_type === "digital" &&
        typeof p.file_url === "string" &&
        p.file_url.startsWith(PFILE_PREFIX),
    );
    if (digital.length === 0) return;

    const links: { name: string; url: string }[] = [];
    for (const p of digital) {
      const { data: existing } = await admin
        .from("download_grants")
        .select("token")
        .eq("order_id", args.orderId)
        .eq("product_id", p.id)
        .maybeSingle();
      let token = existing?.token as string | undefined;
      if (!token) {
        token = nanoid(32);
        const { error } = await admin.from("download_grants").insert({
          order_id: args.orderId,
          product_id: p.id,
          seller_user_id: args.sellerUserId,
          buyer_email: email,
          token,
          file_url: p.file_url,
          file_name: p.file_name,
          download_limit: p.download_limit,
        });
        if (error) {
          console.error("[downloads] grant insert failed", error.message);
          continue;
        }
      }
      links.push({ name: p.name ?? "Your download", url: `${APP_URL}/download/${token}` });
    }
    if (links.length === 0) return;

    const { sendEmail } = await import("@/lib/email");
    const rows = links
      .map(
        (l) =>
          `<p style="margin:8px 0"><a href="${l.url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">⬇ Download ${escapeHtml(l.name)}</a></p>`,
      )
      .join("");
    await sendEmail({
      to: email,
      role: "billing",
      sellerId: args.sellerUserId,
      subject: "Your download is ready",
      html: `<h2 style="margin:0 0 12px">Thanks for your purchase 🎉</h2>
        <p>Your download${links.length > 1 ? "s are" : " is"} ready. You can also access ${links.length > 1 ? "them" : "it"} anytime from your account.</p>
        ${rows}
        <p style="color:#666;font-size:12px;margin-top:16px">Keep this email safe. If a download limit applies, the link stops working after that many downloads.</p>`,
    });
  } catch (e) {
    console.error("[downloads] grantDigitalDownloads failed", e);
  }
}
