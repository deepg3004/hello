// POST /api/checkout/verify-payment
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
//
// Validates the in-checkout signature, marks the order paid, writes ledger
// rows, marks the abandoned_checkout as recovered, rolls up totals on
// pages and user_profiles, and triggers post-purchase work.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUYER_COOKIE,
  BUYER_COOKIE_TTL_DAYS,
  signBuyerSession,
} from "@/lib/buyer-portal";
import { verifyPayment, verifyPaymentWithSecret } from "@/lib/razorpay";
import { loadSellerGatewayKeys, type GatewayType } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";
import { notifyPaymentReceived } from "@/lib/notifications/events";
import {
  chargePlatformWalletFee,
  decrementStockForOrder,
  deliverOrderProducts,
} from "@/lib/order-fulfillment";
import { fireMarketingWebhook } from "@/lib/marketing";
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
import { computeCommission, refCookieName } from "@/lib/affiliate";

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
  if (!order_id) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, page_id, seller_user_id, product_id, amount, platform_commission, seller_amount, currency, coupon_id, status, buyer_email, buyer_name, buyer_address, source, gateway_owner, payment_gateway, gateway_order_id",
    )
    .eq("id", order_id)
    .single();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  // Cart orders (source='cart', multi-line) MUST finalize on the cart path —
  // this single-item route reads orders.product_id (NULL for carts), so letting
  // one through here would skip per-line stock + the itemized receipt.
  if (order.source === "cart") {
    return NextResponse.json({ error: "Wrong checkout endpoint for this order" }, { status: 400 });
  }

  // Confirm the payment with the gateway the order was created on. Razorpay
  // returns an in-checkout signature we HMAC-verify (platform secret for
  // platform orders, the seller's secret for seller-gateway orders). Other
  // providers (Cashfree) have no in-checkout signature, so we confirm by
  // fetching the order status from the seller's gateway via its driver.
  const provider = (order.payment_gateway ?? "razorpay") as GatewayType;
  let signatureValid: boolean;
  let paymentRef: string | null = null; // stored as gateway_payment_id
  let signatureRef: string | null = null; // stored as gateway_signature

  if (provider === "razorpay") {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (order.gateway_owner === "seller") {
      const keys = await loadSellerGatewayKeys(order.seller_user_id);
      signatureValid = keys
        ? verifyPaymentWithSecret(
            { razorpay_order_id, razorpay_payment_id, razorpay_signature },
            keys.key_secret,
          )
        : false;
    } else {
      signatureValid = verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
    }
    paymentRef = razorpay_payment_id;
    signatureRef = razorpay_signature;
  } else if (isLiveGateway(provider)) {
    const keys = await loadSellerGatewayKeys(order.seller_user_id);
    signatureValid =
      keys && order.gateway_order_id
        ? await getGateway(provider).verifyPayment(keys, {
            orderId: order.gateway_order_id,
          })
        : false;
    paymentRef = order.gateway_order_id ?? null;
    signatureRef = null;
  } else {
    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Payment not confirmed" }, { status: 401 });
  }

  if (order.status === "paid") {
    // Idempotent — already marked.
    return attachBuyerSession(
      NextResponse.json({
        ok: true,
        order_id,
        redirect_url: redirectUrl(order_id, order.page_id),
        already_paid: true,
      }),
      order.buyer_email,
    );
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

  // 1. Mark order paid (and any bump child row riding on the same payment).
  //    Guarded by status='pending' so a delayed/replayed verify call can't
  //    transition refunded/cancelled rows back to paid. Pairs with the
  //    short-circuit at L65 (already-paid → idempotent return).
  const paidAt = new Date().toISOString();
  const { data: paidRows } = await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: paymentRef,
      gateway_signature: signatureRef,
      paid_at: paidAt,
      exp_variant: expVariant,
    })
    .eq("id", order_id)
    .eq("status", "pending")
    .select("id");
  // True only when THIS call performed the pending→paid transition. The
  // payment webhook makes the same guarded transition, so gating the in-app
  // notification on the rowcount means the bell fires exactly once whichever
  // path wins the race.
  const didTransition = !!paidRows && paidRows.length > 0;

  // Concurrency guard: if we did NOT win the pending→paid transition, another
  // verify call or the payment webhook already finalized this order. Bail here
  // so every financial side-effect below (sale/commission ledger, page revenue,
  // platform wallet fee, stock decrement, AB counters, fulfillment) runs
  // exactly once — mirrors the rowcount guard the webhooks already use. Without
  // this, two racing verify calls (double-click / client retry) double-charge
  // the wallet fee and double-decrement stock.
  if (!didTransition) {
    return attachBuyerSession(
      NextResponse.json({
        ok: true,
        order_id,
        redirect_url: redirectUrl(order_id, order.page_id),
        already_paid: true,
      }),
      order.buyer_email,
    );
  }

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
      gateway_payment_id: paymentRef,
      paid_at: paidAt,
    })
    .eq("parent_order_id", order_id)
    .eq("source", "bump")
    .eq("status", "pending");

  // 2. Ledger: sale (seller credit) + commission (platform credit)
  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id,
      type: "sale",
      amount: Number(order.seller_amount),
      status: "completed",
      reference_id: paymentRef,
      notes: `Sale ${order.gateway_order_id ?? order_id}`,
    },
    {
      user_id: order.seller_user_id,
      order_id,
      type: "commission",
      amount: -Number(order.platform_commission),
      status: "completed",
      reference_id: paymentRef,
      notes: `Platform commission ${order.gateway_order_id ?? order_id}`,
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

  // 4. Roll up totals — single atomic SQL function (migration 018) so
  //    two concurrent payments on the same page can't both read the same
  //    total_revenue and clobber each other.
  if (order.page_id) {
    const { error: rollupErr } = await admin.rpc("increment_page_revenue", {
      p_page_id: order.page_id,
      p_seller_id: order.seller_user_id,
      p_amount: Number(order.amount ?? 0),
    });
    if (rollupErr) {
      // Don't fail the payment over a rollup hiccup — log + carry on.
      console.error("[verify-payment] increment_page_revenue failed", rollupErr);
    }
  } else {
    // Subscription / order without a page — bump the seller's total directly.
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

  // 4b. Wallet — deduct the platform fee (migration 040). Shared with the
  //     seller-gateway webhook so the revenue logic can't drift. Best-effort:
  //     never throws; safe no-op until migration 040 + a funded wallet exist.
  await chargePlatformWalletFee(
    { sellerUserId: order.seller_user_id, orderId: order_id },
    admin,
  );
  // Inventory: decrement stock for physical products (no-op for digital).
  await decrementStockForOrder(order_id, admin);
  // Marketing: outbound webhook (best-effort).
  await fireMarketingWebhook(order.seller_user_id, "order_paid", {
    order_id,
    amount: Number(order.amount ?? 0),
    buyer_email: order.buyer_email,
    page_id: order.page_id,
  });

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

  // 5d*. Affiliate attribution — read the ref_<slug> cookie set by
  //      /api/affiliate/track-click and, if it matches the page's active
  //      program, mint an affiliate_payouts row in 'pending' state.
  // SECURITY / FIXME (audit #17 — affiliate refund flow):
  // Affiliate commission is minted here on payment.captured but there is no
  // matching reversal when the parent order is later refunded. The refund
  // handler at actions/transactions.ts:refundOrderAction must also mark the
  // matching affiliate_payouts row 'reversed' (or insert a negating row).
  // Deferred — pairs with the refund-reversal decision tracked above.
  try {
    if (order.page_id) {
      const { data: pageRow } = await admin
        .from("pages")
        .select("slug")
        .eq("id", order.page_id)
        .single();
      if (pageRow?.slug) {
        const cookieHeader = request.headers.get("cookie") ?? "";
        const want = refCookieName(pageRow.slug);
        const match = cookieHeader
          .split(/;\s*/)
          .find((p) => p.startsWith(`${want}=`));
        const refCode = match?.split("=")[1];
        if (refCode) {
          const { data: link } = await admin
            .from("affiliate_links")
            .select(
              "id, affiliate_id, status, conversions, earnings, affiliates(commission_type, commission_value, status, page_id)",
            )
            .eq("referral_code", refCode)
            .maybeSingle();
          type Joined = {
            commission_type: string;
            commission_value: number;
            status: string;
            page_id: string;
          };
          const programRel = (link as unknown as { affiliates: Joined | Joined[] | null })
            ?.affiliates;
          const program = Array.isArray(programRel) ? programRel[0] : programRel;
          if (
            link &&
            link.status === "active" &&
            program?.status === "active" &&
            program.page_id === order.page_id
          ) {
            const commission = computeCommission(
              {
                commission_type:
                  program.commission_type as "percentage" | "fixed",
                commission_value: Number(program.commission_value),
                status: "active",
              },
              Number(order.amount ?? 0),
            );
            if (commission > 0) {
              const { error: insErr } = await admin
                .from("affiliate_payouts")
                .insert({
                  affiliate_link_id: link.id,
                  affiliate_id: link.affiliate_id,
                  seller_user_id: order.seller_user_id,
                  order_id: order.id,
                  commission_amount: commission,
                });
              if (!insErr) {
                await admin
                  .from("affiliate_links")
                  .update({
                    conversions: Number(link.conversions ?? 0) + 1,
                    earnings: Number(link.earnings ?? 0) + commission,
                  })
                  .eq("id", link.id);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("[verify-payment] affiliate attribution failed", e);
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

  // 5e². In-app bell — seller + admins. Gated on the transition above so it
  //      fires once across the verify-payment + webhook paths. Best-effort.
  if (didTransition) {
    await notifyPaymentReceived(
      {
        sellerId: order.seller_user_id,
        amountRupees: Number(order.amount),
        buyer: order.buyer_name ?? order.buyer_email,
        pageId: order.page_id,
        orderId: order.id,
      },
      admin,
    );
  }

  // 5f. Deliver the purchased products: receipt + invoice + Telegram + Discord
  //     + course enrollment + digital downloads. Shared with the seller-gateway
  //     webhook (lib/order-fulfillment.deliverOrderProducts) so a dropped-tab
  //     payment confirmed by webhook still delivers everything. Best-effort.
  await deliverOrderProducts(
    {
      id: order.id,
      page_id: order.page_id,
      product_id: order.product_id,
      seller_user_id: order.seller_user_id,
      buyer_email: order.buyer_email,
      buyer_name: order.buyer_name,
      amount: Number(order.amount),
      currency: order.currency,
    },
    admin,
  );
  // The order-bump child rides on the same payment and needs its own invoice.
  try {
    const { enqueueInvoiceJob } = await import("@/lib/queues/invoices");
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
    console.error("[verify-payment] bump invoice enqueue failed", e);
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

  // (Product delivery — receipt/invoice/Telegram/Discord/course/downloads — was
  //  handled by deliverOrderProducts() at step 5f above, shared with the webhook.)

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
  return attachBuyerSession(response, order.buyer_email);
}

function redirectUrl(orderId: string, _pageId: string | null): string {
  return `/order/${orderId}?status=success`;
}

/** Sign the buyer into their account on this host right after a successful
 *  purchase — so "My Account" + their orders are available with no separate
 *  OTP login. Appended (not set) so it never clobbers other Set-Cookie. */
function attachBuyerSession(res: NextResponse, email: string | null): NextResponse {
  const e = email?.trim().toLowerCase();
  if (e) {
    const token = signBuyerSession(e);
    res.headers.append(
      "Set-Cookie",
      `${BUYER_COOKIE}=${token}; Max-Age=${BUYER_COOKIE_TTL_DAYS * 86400}; Path=/; HttpOnly; SameSite=Lax`,
    );
  }
  return res;
}
