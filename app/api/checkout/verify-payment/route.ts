// POST /api/checkout/verify-payment
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
//
// Validates the in-checkout signature, marks the order paid, writes ledger
// rows, marks the abandoned_checkout as recovered, rolls up totals on
// pages and user_profiles, and triggers post-purchase work.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/razorpay";
import { settleCoupon } from "@/lib/coupons";
import { getRedis } from "@/lib/redis";
import {
  conversionsKey,
  revenueKey,
  variantCookieName,
} from "@/lib/ab";
import {
  anonymiseName,
  shortCity,
  spCountKey,
  SP_MAX_EVENTS_KEPT,
} from "@/lib/social-proof";

export async function POST(request: Request) {
  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    order_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (!verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, page_id, seller_user_id, product_id, amount, platform_commission, seller_amount, currency, coupon_id, status, buyer_email, buyer_name, buyer_address, source",
    )
    .eq("id", order_id)
    .single();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "paid") {
    // Idempotent — already marked.
    return NextResponse.json({
      ok: true,
      order_id,
      redirect_url: redirectUrl(order_id, order.page_id),
      already_paid: true,
    });
  }

  // 0. A/B — sniff the variant cookie for this page (if any).
  let expVariant: "A" | "B" | null = null;
  let expSlug: string | null = null;
  try {
    if (order.page_id) {
      const { data: pageRow } = await admin
        .from("pages")
        .select("slug, experiment_status")
        .eq("id", order.page_id)
        .single();
      if (pageRow?.experiment_status === "running" && pageRow.slug) {
        expSlug = pageRow.slug;
        const cookieHeader = request.headers.get("cookie") ?? "";
        const want = variantCookieName(pageRow.slug);
        const match = cookieHeader
          .split(/;\s*/)
          .find((p) => p.startsWith(`${want}=`));
        const val = match?.split("=")[1];
        if (val === "A" || val === "B") expVariant = val;
      }
    }
  } catch (e) {
    console.error("[verify-payment] AB cookie read failed", e);
  }

  // 1. Mark order paid (and any bump child row riding on the same payment)
  const paidAt = new Date().toISOString();
  await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: razorpay_payment_id,
      gateway_signature: razorpay_signature,
      paid_at: paidAt,
      exp_variant: expVariant,
    })
    .eq("id", order_id);

  // 1b. AB conversion counters — best-effort. Revenue tracked in paise so we
  //     don't lose paisa-level precision when summing.
  if (expSlug && expVariant) {
    try {
      const redis = getRedis();
      if (redis) {
        await redis.incr(conversionsKey(expSlug, expVariant));
        const paise = Math.round(Number(order.amount ?? 0) * 100);
        if (paise > 0) {
          await redis.incrby(revenueKey(expSlug, expVariant), paise);
        }
      }
    } catch (e) {
      console.error("[verify-payment] AB INCR failed", e);
    }
  }
  await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: razorpay_payment_id,
      paid_at: paidAt,
    })
    .eq("parent_order_id", order_id)
    .eq("source", "bump");

  // 2. Ledger: sale (seller credit) + commission (platform credit)
  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id,
      type: "sale",
      amount: Number(order.seller_amount),
      status: "completed",
      reference_id: razorpay_payment_id,
      notes: `Sale ${razorpay_order_id}`,
    },
    {
      user_id: order.seller_user_id,
      order_id,
      type: "commission",
      amount: -Number(order.platform_commission),
      status: "completed",
      reference_id: razorpay_payment_id,
      notes: `Platform commission ${razorpay_order_id}`,
    },
  ]);

  // 3. Abandoned checkout → recovered (+ cancel scheduled recovery jobs).
  // We need the job_ids BEFORE we flip the status — pull them, then update.
  try {
    const { data: abandoned } = await admin
      .from("abandoned_checkouts")
      .select("id, recovery_job_ids")
      .eq("buyer_email", order.buyer_email)
      .eq("page_id", order.page_id)
      .eq("status", "active");

    await admin
      .from("abandoned_checkouts")
      .update({ status: "recovered", recovered_at: paidAt })
      .eq("buyer_email", order.buyer_email)
      .eq("page_id", order.page_id)
      .eq("status", "active");

    if (abandoned && abandoned.length > 0) {
      const { cancelRecovery } = await import("@/lib/queues/recovery");
      for (const row of abandoned) {
        const ids = (row.recovery_job_ids ?? {}) as {
          email1?: string;
          whatsapp?: string;
          email2?: string;
          expire?: string;
        };
        // Fire-and-forget — recovery cancel failures shouldn't block payment.
        void cancelRecovery(ids).catch((e) =>
          console.error("[verify-payment] cancelRecovery failed", e),
        );
      }
    }
  } catch (e) {
    console.error("[verify-payment] abandoned_checkouts cleanup failed", e);
    // Still keep marching — payment is verified.
    await admin
      .from("abandoned_checkouts")
      .update({ status: "recovered", recovered_at: paidAt })
      .eq("buyer_email", order.buyer_email)
      .eq("page_id", order.page_id)
      .eq("status", "active");
  }

  // 4. Roll up totals — read, increment, write (no SQL fn here)
  if (order.page_id) {
    const { data: page } = await admin
      .from("pages")
      .select("total_revenue, conversion_count")
      .eq("id", order.page_id)
      .single();
    if (page) {
      await admin
        .from("pages")
        .update({
          total_revenue:
            Number(page.total_revenue ?? 0) + Number(order.amount ?? 0),
          conversion_count: Number(page.conversion_count ?? 0) + 1,
        })
        .eq("id", order.page_id);
    }
  }
  {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("total_revenue")
      .eq("id", order.seller_user_id)
      .single();
    if (profile) {
      await admin
        .from("user_profiles")
        .update({
          total_revenue:
            Number(profile.total_revenue ?? 0) + Number(order.amount ?? 0),
        })
        .eq("id", order.seller_user_id);
    }
  }

  // 5. Settle coupon usage_count in Postgres — atomic UPDATE that refuses to
  //    cross the total_limit. If two checkouts race for the last slot, the
  //    second one's increment matches zero rows. We log that case but the
  //    order itself still completes — the buyer was already charged before
  //    this point.
  if (order.coupon_id) {
    try {
      const incremented = await settleCoupon(order.coupon_id);
      if (!incremented) {
        console.warn("[verify-payment] coupon depleted at settle time", {
          order_id,
          coupon_id: order.coupon_id,
        });
      }
    } catch (e) {
      console.error("settleCoupon failed", e);
    }
  }

  // 5e. Notify the seller of the new sale (WhatsApp + email — best-effort).
  try {
    const { notifyNewSale } = await import("@/lib/notification-triggers");
    void notifyNewSale({
      id: order.id,
      seller_user_id: order.seller_user_id,
      buyer_name: order.buyer_name,
      buyer_email: order.buyer_email,
      amount: order.amount,
      seller_amount: order.seller_amount,
      product_id: order.product_id,
      page_id: order.page_id,
    });
  } catch (e) {
    console.error("[verify-payment] notifyNewSale dispatch failed", e);
  }

  // 5f. Enqueue invoice generation. The job runs in the background BullMQ
  //     worker — we don't await it so the response stays snappy. The OTO
  //     follow-on order generates its own separate invoice when it's paid.
  try {
    const { enqueueInvoiceJob } = await import("@/lib/queues/invoices");
    void enqueueInvoiceJob(order_id);
    // Also enqueue an invoice for the bump child row if there is one.
    const { data: bumpChild } = await admin
      .from("orders")
      .select("id")
      .eq("parent_order_id", order_id)
      .eq("source", "bump")
      .maybeSingle();
    if (bumpChild?.id) {
      void enqueueInvoiceJob(bumpChild.id);
    }
  } catch (e) {
    console.error("[verify-payment] invoice enqueue failed", e);
  }

  // 5h*. Meta Conversions API — best-effort server-side Purchase fire.
  //      Runs in parallel with the buyer receipt below.
  try {
    if (order.page_id) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
      const secret = process.env.CRON_SECRET ?? "";
      void fetch(`${baseUrl}/api/pixels/meta-capi`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": secret,
        },
        body: JSON.stringify({
          order_id: order.id,
          event_name: "Purchase",
        }),
      }).catch((e) => console.error("[verify-payment] CAPI dispatch", e));
    }
  } catch (e) {
    console.error("[verify-payment] CAPI dispatch failed", e);
  }

  // 5g. Sale-confirmation receipt to the buyer. The PDF link points at our
  //     public /api/orders/:id/invoice redirect — it generates inline if the
  //     worker hasn't caught up. The email itself goes out immediately.
  try {
    const { sendEmail, saleConfirmationEmail } = await import("@/lib/email");
    const { data: prod } = order.product_id
      ? await admin
          .from("products")
          .select("name")
          .eq("id", order.product_id)
          .single<{ name: string }>()
      : { data: null };
    const { data: sellerForReceipt } = await admin
      .from("user_profiles")
      .select("legal_business_name, full_name")
      .eq("id", order.seller_user_id)
      .single<{ legal_business_name: string | null; full_name: string | null }>();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
    const tpl = saleConfirmationEmail({
      buyerName: order.buyer_name,
      sellerLegalName:
        sellerForReceipt?.legal_business_name ??
        sellerForReceipt?.full_name ??
        null,
      productName: prod?.name ?? null,
      amountInr: Number(order.amount),
      currency: order.currency ?? "INR",
      orderId: order_id,
      invoiceUrl: `${baseUrl}/api/orders/${order_id}/invoice`,
      orderUrl: `${baseUrl}/order/${order_id}`,
    });
    void sendEmail({ to: order.buyer_email, subject: tpl.subject, html: tpl.html });
  } catch (e) {
    console.error("[verify-payment] receipt email dispatch failed", e);
  }

  // 5h. Social-proof event — anonymised name + city for the public widgets
  //     on /p/[slug]. Best-effort and trimmed to the last 20 rows per page.
  try {
    if (order.page_id) {
      const { data: prod } = order.product_id
        ? await admin
            .from("products")
            .select("name")
            .eq("id", order.product_id)
            .single<{ name: string }>()
        : { data: null };

      const buyerAddrCity =
        (order.buyer_address &&
          typeof order.buyer_address === "object" &&
          // The order may carry GST billing OR a generic shipping address.
          ((order.buyer_address as Record<string, unknown>).city as
            | string
            | null)) ||
        null;
      // Optional: pull-through-IP could be done with a geo provider — we
      // leave hook present but fall back to "—" when no city is known.

      const spInsert = await admin
        .from("social_proof_events")
        .insert({
          page_id: order.page_id,
          buyer_name: anonymiseName(order.buyer_name),
          buyer_city: shortCity(buyerAddrCity),
          product_name: prod?.name ?? null,
          amount: Number(order.amount ?? 0),
          is_seed: false,
        })
        .select("id")
        .single();
      if (spInsert.data) {
        // Keep only the last N rows for this page — fetch the (N+1)th row's
        // created_at and delete everything older. Cheap with the existing
        // created_at index.
        const { data: cutoff } = await admin
          .from("social_proof_events")
          .select("created_at")
          .eq("page_id", order.page_id)
          .order("created_at", { ascending: false })
          .range(SP_MAX_EVENTS_KEPT, SP_MAX_EVENTS_KEPT)
          .maybeSingle();
        if (cutoff?.created_at) {
          await admin
            .from("social_proof_events")
            .delete()
            .eq("page_id", order.page_id)
            .lt("created_at", cutoff.created_at);
        }
      }

      // Realtime total counter — survives the prune above.
      try {
        const redis = getRedis();
        if (redis) await redis.incr(spCountKey(order.page_id));
      } catch {
        /* non-fatal */
      }
    }
  } catch (e) {
    console.error("[verify-payment] social-proof insert failed", e);
  }

  // 6. Post-purchase: if the page has a Telegram VIP group attached, mint a
  //    one-time invite + membership row. Best-effort — bot/group failures
  //    surface on the thank-you page but don't block checkout.
  try {
    const { issueInviteForOrder } = await import("@/actions/telegram");
    const inviteResult = await issueInviteForOrder(order_id);
    if (inviteResult.ok && "invite_link" in inviteResult) {
      const { inviteEmail, sendEmail } = await import("@/lib/email");
      const { data: page } = await admin
        .from("pages")
        .select("telegram_group_id, telegram_vip_groups(group_name)")
        .eq("id", order.page_id ?? "")
        .single();
      type Joined = { group_name: string | null };
      const groupRel = (page as unknown as { telegram_vip_groups: Joined | Joined[] | null } | null)?.telegram_vip_groups;
      const groupName = (Array.isArray(groupRel) ? groupRel[0]?.group_name : groupRel?.group_name) ?? undefined;
      const tpl = inviteEmail({
        buyerName: order.buyer_name ?? undefined,
        groupName,
        inviteLink: inviteResult.invite_link,
      });
      await sendEmail({
        to: order.buyer_email,
        subject: tpl.subject,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error("[verify-payment] telegram invite failed", e);
  }

  // 7. OTO — if the page has an OTO configured AND this is the original
  // (non-OTO) order, mint a 15-min signed cookie and redirect to /p/<slug>/oto.
  let redirectTarget = redirectUrl(order_id, order.page_id);
  let setCookie: string | null = null;
  try {
    const isOtoFollowOn = order.source === "oto";
    if (!isOtoFollowOn && order.page_id) {
      const { data: page } = await admin
        .from("pages")
        .select("slug, page_config")
        .eq("id", order.page_id)
        .single();
      const cfg = (page?.page_config as { oto_config?: { enabled?: boolean; product_id?: string } } | null)?.oto_config;
      if (cfg?.enabled && cfg.product_id && page?.slug) {
        const { signOtoToken, OTO_COOKIE_NAME, OTO_TTL_SECONDS } = await import("@/lib/oto-token");
        try {
          const token = signOtoToken({
            order_id,
            page_id: order.page_id,
            slug: page.slug,
          });
          setCookie = `${OTO_COOKIE_NAME}=${token}; Max-Age=${OTO_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax`;
          redirectTarget = `/p/${page.slug}/oto`;
          await admin
            .from("orders")
            .update({ oto_offered: true })
            .eq("id", order_id);
        } catch (e) {
          console.error("[verify-payment] OTO token sign failed", e);
        }
      }
    }
  } catch (e) {
    console.error("[verify-payment] OTO check failed", e);
  }

  const response = NextResponse.json({
    ok: true,
    success: true,
    order_id,
    redirect_url: redirectTarget,
  });
  if (setCookie) response.headers.set("Set-Cookie", setCookie);
  return response;
}

function redirectUrl(orderId: string, _pageId: string | null): string {
  return `/order/${orderId}?status=success`;
}
