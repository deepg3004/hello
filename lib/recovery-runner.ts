// =============================================================================
// Cart-recovery job handlers.
//
// Each function is called by the BullMQ worker. They:
//   * load the abandoned_checkouts row by id
//   * bail if the cart has already been recovered or expired
//   * render + send the corresponding message via Resend / MSG91
//   * stamp the relevant *_sent_at column and (where applicable) the Resend
//     message id so the open-tracking webhook can match it back
//
// All failures throw so BullMQ retries with backoff; transient outages don't
// leave the row in an inconsistent state.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/emails/render";
import { sendWhatsApp, WA_TEMPLATES } from "@/lib/twilio";

interface AbandonedRow {
  id: string;
  page_id: string | null;
  product_id: string | null;
  seller_user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  amount: number | string | null;
  status: string;
  recovery_token: string | null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

async function loadActive(abandonedId: string): Promise<AbandonedRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("abandoned_checkouts")
    .select(
      "id, page_id, product_id, seller_user_id, buyer_email, buyer_name, buyer_phone, amount, status, recovery_token",
    )
    .eq("id", abandonedId)
    .single<AbandonedRow>();
  if (!data) return null;
  if (data.status !== "active") return null;
  return data;
}

interface PageBundle {
  slug: string;
  title: string;
  seller_name: string;
  product_name: string;
  product_image_url: string | null;
  product_price: number | null;
}

async function loadPageBundle(row: AbandonedRow): Promise<PageBundle | null> {
  if (!row.page_id) return null;
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "slug, title, user_id, user_profiles!pages_user_id_fkey(full_name, legal_business_name)",
    )
    .eq("id", row.page_id)
    .single();
  if (!page) return null;

  type Seller = { full_name: string | null; legal_business_name: string | null };
  const sellerRel = (page as unknown as { user_profiles: Seller | Seller[] | null })
    .user_profiles;
  const seller = Array.isArray(sellerRel) ? sellerRel[0] : sellerRel;

  let productName = "Your purchase";
  let productImage: string | null = null;
  let productPrice: number | null =
    row.amount != null ? Number(row.amount) : null;
  const productId = row.product_id;
  if (productId) {
    const { data: prod } = await admin
      .from("products")
      .select("name, image_url, price")
      .eq("id", productId)
      .single();
    if (prod) {
      productName = prod.name ?? productName;
      productImage = prod.image_url ?? null;
      productPrice = Number(prod.price ?? productPrice);
    }
  }

  return {
    slug: page.slug,
    title: page.title,
    seller_name:
      seller?.legal_business_name ?? seller?.full_name ?? "the seller",
    product_name: productName,
    product_image_url: productImage,
    product_price: productPrice,
  };
}

function recoveryUrl(slug: string, token: string | null): string {
  if (!token) return `${APP_URL}/p/${slug}`;
  return `${APP_URL}/p/${slug}?r=${encodeURIComponent(token)}`;
}

// ----------------------------------------------------------------------------
// Job 1 — Email at T+30min
// ----------------------------------------------------------------------------

export async function runSendRecoveryEmail1(abandonedId: string): Promise<void> {
  const row = await loadActive(abandonedId);
  if (!row) return;
  const bundle = await loadPageBundle(row);
  if (!bundle) return;

  const url = recoveryUrl(bundle.slug, row.recovery_token);
  const tpl = await renderEmail("recovery_1", {
    buyerName: row.buyer_name,
    sellerName: bundle.seller_name,
    productName: bundle.product_name,
    productImage: bundle.product_image_url,
    productPrice: bundle.product_price,
    recoveryUrl: url,
  });

  const res = await sendEmail({
    to: row.buyer_email,
    subject: tpl.subject,
    html: tpl.html,
    tags: [
      { name: "type", value: "recovery_email_1" },
      { name: "abandoned_id", value: row.id },
    ],
  });
  if (!res.ok && !res.skipped) throw new Error(res.message ?? "email1 send failed");

  const admin = createAdminClient();
  await admin
    .from("abandoned_checkouts")
    .update({
      recovery_email1_sent_at: new Date().toISOString(),
      recovery_email1_message_id: res.id ?? null,
      recovery_step: 1,
    })
    .eq("id", row.id);
}

// ----------------------------------------------------------------------------
// Job 2 — WhatsApp at T+2h
// ----------------------------------------------------------------------------

export async function runSendRecoveryWhatsApp(abandonedId: string): Promise<void> {
  const row = await loadActive(abandonedId);
  if (!row) return;
  if (!row.buyer_phone) return; // nothing to send to
  const bundle = await loadPageBundle(row);
  if (!bundle) return;

  const url = recoveryUrl(bundle.slug, row.recovery_token);

  // MSG91 template (must be pre-registered):
  //   INVOX_RECOVERY_CART body:
  //     "Hi {{1}}, you started checking out {{2}} on {{3}}'s page but
  //      didn't complete. Complete your purchase: {{4}}"
  const res = await sendWhatsApp(
    row.buyer_phone,
    WA_TEMPLATES.RECOVERY_CART,
    [
      row.buyer_name ?? "there",
      bundle.product_name,
      bundle.seller_name,
      url,
    ],
  );
  if (!res.ok && !res.skipped) throw new Error(res.message ?? "wa send failed");

  const admin = createAdminClient();
  await admin
    .from("abandoned_checkouts")
    .update({
      recovery_whatsapp_sent_at: new Date().toISOString(),
      recovery_step: 2,
    })
    .eq("id", row.id);
}

// ----------------------------------------------------------------------------
// Job 3 — Email 2 at T+24h, attaches the seller's recovery coupon if pinned
// ----------------------------------------------------------------------------

export async function runSendRecoveryEmail2(abandonedId: string): Promise<void> {
  const row = await loadActive(abandonedId);
  if (!row) return;
  const bundle = await loadPageBundle(row);
  if (!bundle) return;

  // Pull seller's pinned recovery coupon.
  const admin = createAdminClient();
  let couponCode: string | null = null;
  let couponLabel: string | null = null;
  if (row.seller_user_id) {
    const { data: seller } = await admin
      .from("user_profiles")
      .select("recovery_coupon_id")
      .eq("id", row.seller_user_id)
      .single();
    if (seller?.recovery_coupon_id) {
      const { data: cpn } = await admin
        .from("coupons")
        .select(
          "id, code, discount_type, discount_value, total_limit, usage_count, is_active",
        )
        .eq("id", seller.recovery_coupon_id)
        .single();
      if (
        cpn &&
        cpn.is_active &&
        (cpn.total_limit == null || cpn.usage_count < cpn.total_limit)
      ) {
        couponCode = cpn.code;
        couponLabel =
          cpn.discount_type === "percent"
            ? `${cpn.discount_value}% off`
            : `₹${cpn.discount_value} off`;
      }
    }
  }

  const url = recoveryUrl(bundle.slug, row.recovery_token);
  const tpl = await renderEmail("recovery_2", {
    buyerName: row.buyer_name,
    sellerName: bundle.seller_name,
    productName: bundle.product_name,
    productImage: bundle.product_image_url,
    productPrice: bundle.product_price,
    recoveryUrl: url,
    couponCode,
    couponLabel,
  });

  const res = await sendEmail({
    to: row.buyer_email,
    subject: tpl.subject,
    html: tpl.html,
    tags: [
      { name: "type", value: "recovery_email_2" },
      { name: "abandoned_id", value: row.id },
    ],
  });
  if (!res.ok && !res.skipped) throw new Error(res.message ?? "email2 send failed");

  await admin
    .from("abandoned_checkouts")
    .update({
      recovery_email2_sent_at: new Date().toISOString(),
      recovery_email2_message_id: res.id ?? null,
      recovery_step: 3,
    })
    .eq("id", row.id);
}

// ----------------------------------------------------------------------------
// Job 4 — Expire the cart at T+72h
// ----------------------------------------------------------------------------

export async function runExpireAbandonedCheckout(
  abandonedId: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("abandoned_checkouts")
    .update({ status: "expired", recovery_step: 4 })
    .eq("id", abandonedId)
    .eq("status", "active"); // only flip if still active
}
