// POST /api/checkout/create-order
//
// Body: {
//   page_id, product_id, buyer_email, buyer_name, buyer_phone,
//   amount,            // client-supplied — server re-validates against products.price
//   coupon_code?,      // optional
//   utm_source?, utm_medium?, utm_campaign?
// }
//
// Returns the data the client needs to launch Razorpay Checkout:
//   { razorpay_order_id, amount, currency, key, name, description,
//     buyer_name, buyer_email, buyer_phone, order_id }

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";
import {
  reserveCoupon,
  releaseCoupon,
  validateCoupon,
} from "@/lib/coupons";
import { type PlanKey } from "@/lib/plans";
import {
  getFeeConfig,
  getRequireWalletBalance,
} from "@/lib/settings";
import {
  resolvePlatformFeePaise,
  feeCategoryForPage,
  gstPercentFromConfig,
  gstOnFeePaise,
} from "@/lib/fees";
import { getWalletFeePaise } from "@/lib/wallet";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isBlocked } from "@/lib/risk/blocklist";
import { evaluateAndFlagOrder } from "@/lib/risk/evaluate";

export async function POST(request: Request) {
  let body: {
    page_id?: string;
    product_id?: string;
    buyer_email?: string;
    buyer_name?: string;
    buyer_phone?: string;
    amount?: number;
    coupon_code?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    // Order bump (added by CheckoutForm when seller enabled it)
    bump_offered?: boolean;
    bump_accepted?: boolean;
    bump_product_id?: string;
    bump_amount?: number;
    // Optional buyer GST capture (B2B invoice path)
    buyer_gstin?: string;
    buyer_state_code?: string;
    buyer_address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state_code?: string;
      pincode?: string;
    };
    custom_fields?: Record<string, unknown> | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Rate limit checkout-order creation per IP to blunt card-testing / abuse.
  const rl = await rateLimit(`order:${clientIp(request)}`, 30, 10 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const {
    page_id,
    product_id,
    buyer_email,
    buyer_name,
    buyer_phone,
    coupon_code,
    utm_source,
    utm_medium,
    utm_campaign,
    bump_offered = false,
    bump_accepted = false,
    bump_product_id,
    bump_amount: bump_amount_in,
    buyer_gstin: buyer_gstin_raw,
    buyer_state_code: buyer_state_code_raw,
    buyer_address: buyer_address_raw,
    custom_fields: custom_fields_raw,
  } = body;

  // Sanitise seller custom-question answers: up to 10 trimmed string entries.
  let custom_fields_clean: Record<string, string> | null = null;
  if (custom_fields_raw && typeof custom_fields_raw === "object") {
    const entries = Object.entries(custom_fields_raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && (v as string).trim())
      .slice(0, 10)
      .map(([k, v]) => [String(k).slice(0, 120), String(v).slice(0, 500)] as const);
    if (entries.length) custom_fields_clean = Object.fromEntries(entries);
  }

  // Normalise + validate the optional GSTIN before we hit Razorpay.
  let buyer_gstin: string | null = null;
  let buyer_state_code: string | null = null;
  if (buyer_gstin_raw) {
    const { GSTIN_REGEX, stateCodeFromGstin } = await import("@/lib/gst");
    const upper = buyer_gstin_raw.trim().toUpperCase();
    if (!GSTIN_REGEX.test(upper)) {
      return NextResponse.json(
        { error: "Buyer GSTIN format is invalid" },
        { status: 400 },
      );
    }
    buyer_gstin = upper;
    buyer_state_code = stateCodeFromGstin(upper);
  }
  if (!buyer_state_code && buyer_state_code_raw) {
    const c = buyer_state_code_raw.trim();
    if (/^[0-9]{2}$/.test(c)) buyer_state_code = c;
  }
  if (!buyer_state_code && buyer_address_raw?.state_code) {
    const c = buyer_address_raw.state_code.trim();
    if (/^[0-9]{2}$/.test(c)) buyer_state_code = c;
  }
  const buyer_address_clean = buyer_address_raw
    ? {
        line1: buyer_address_raw.line1?.trim() || null,
        line2: buyer_address_raw.line2?.trim() || null,
        city: buyer_address_raw.city?.trim() || null,
        state_code: buyer_state_code,
        pincode: buyer_address_raw.pincode?.trim() || null,
        country: "India",
      }
    : null;

  if (!page_id || !product_id || !buyer_email) {
    return NextResponse.json(
      { error: "page_id, product_id and buyer_email are required" },
      { status: 400 },
    );
  }

  // Abuse hard-gate: refuse checkout for blocklisted email / IP / phone before
  // doing any gateway work. Fails open if the lookup errors.
  const block = await isBlocked({
    email: buyer_email,
    ip: clientIp(request),
    phone: buyer_phone,
  });
  if (block.blocked) {
    return NextResponse.json(
      { error: "This order can't be processed. Please contact support." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // 1. Validate page is published
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, slug, status, title, page_config, type, template_id, fee_category")
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json(
      { error: "Page is not available" },
      { status: 404 },
    );
  }

  // 2. Server-side price (never trust client `amount`)
  const { data: product } = await admin
    .from("products")
    .select("id, user_id, price, currency, name, active, requires_shipping, stock")
    .eq("id", product_id)
    .single();
  if (!product || !product.active || product.user_id !== page.user_id) {
    return NextResponse.json(
      { error: "Product is not available" },
      { status: 404 },
    );
  }
  // Inventory gate — only when stock is tracked (stock !== null). Untracked
  // (digital) products have null stock and are never gated.
  if (product.stock !== null && Number(product.stock) <= 0) {
    return NextResponse.json(
      { error: "This product is out of stock." },
      { status: 409 },
    );
  }
  let grossAmount = Number(product.price);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return NextResponse.json({ error: "Product has no price" }, { status: 400 });
  }
  const currency = product.currency ?? "INR";

  // 2a. "Pay what you like" — opt-in via the page's OWN config (never a client
  // claim). When enabled, the buyer may pay the product price OR MORE (the
  // product price stays the hard floor); the client-supplied `amount` is
  // honoured only within [floor, cap]. This never lets a buyer pay LESS than
  // the seller's price, so it can't be abused to underpay.
  const pageCfg = (page.page_config ?? {}) as Record<string, unknown>;
  if (pageCfg.pwyl_enabled === true) {
    const chosen = Number(body.amount);
    const cap = Math.max(grossAmount * 50, 2_000_000); // sane upper bound (₹20L)
    if (Number.isFinite(chosen) && chosen >= grossAmount) {
      grossAmount = Math.min(chosen, cap);
    }
  }

  // 3. Coupon (optional)
  let discountAmount = 0;
  let couponId: string | null = null;
  let couponTotalLimit: number | null = null;
  let couponPerCustomerLimit: number | null = null;
  if (coupon_code) {
    const validation = await validateCoupon({
      code: coupon_code,
      page_id,
      amount: grossAmount,
      buyer_email,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }
    discountAmount = validation.discount_amount;
    couponId = validation.coupon_id;

    // Pull limits to feed reserveCoupon.
    const { data: cRow } = await admin
      .from("coupons")
      .select("total_limit, per_customer_limit")
      .eq("id", couponId)
      .single();
    couponTotalLimit = cRow?.total_limit ?? null;
    couponPerCustomerLimit = cRow?.per_customer_limit ?? null;

    // SECURITY / FIXME (audit #4 — coupon race on max_uses=1):
    // reserveCoupon() uses Redis INCR + DECR which is *not* atomic with the
    // order INSERT below. Two concurrent buyers can both pass the reserve
    // check, both create orders, and both consume a coupon whose total_limit
    // is 1. settleCoupon() in verify-payment partially mitigates by guarding
    // its UPDATE, but the duplicate order rows are still persisted. Proper
    // fix: pull `for update` lock on the coupon row inside the same
    // transaction as the order insert, or use a Postgres advisory lock keyed
    // on coupon_id. Needs a small Supabase RPC — deferred to its own change.
    const reserved = await reserveCoupon(
      couponId,
      couponTotalLimit,
      buyer_email,
      couponPerCustomerLimit,
    );
    if (!reserved) {
      return NextResponse.json({ error: "Coupon just sold out" }, { status: 409 });
    }
  }

  // Everything below is computed in paise integers to avoid floating-point
  // drift on the ledger. The previous implementation rounded in rupees three
  // separate times so seller_amount + platform_commission could be off the
  // gross by a paisa or two — small per order, but compounding.
  const grossPaise = Math.round(grossAmount * 100);
  const discountPaise = Math.round(discountAmount * 100);
  const baseNetPaise = Math.max(0, grossPaise - discountPaise);

  // 3b. Bump — server-validate the price against the seller's product. We
  // never trust the client-supplied bump_amount; instead we read the product
  // and use its price (allowing optional client override only when it's
  // strictly less, never more — i.e. seller's discount).
  let bumpProduct: { id: string; user_id: string; name: string; price: number } | null = null;
  let bumpPaise = 0;
  if (bump_accepted && bump_product_id) {
    const { data: bp } = await admin
      .from("products")
      .select("id, user_id, name, price, active")
      .eq("id", bump_product_id)
      .single();
    if (!bp || bp.user_id !== page.user_id || !bp.active) {
      if (couponId) await releaseCoupon(couponId, buyer_email);
      return NextResponse.json({ error: "Bump product unavailable" }, { status: 400 });
    }
    bumpProduct = {
      id: bp.id,
      user_id: bp.user_id,
      name: bp.name,
      price: Number(bp.price ?? 0),
    };
    const bumpProductPaise = Math.round(bumpProduct.price * 100);
    const clientBumpPaise = Math.round(Number(bump_amount_in ?? bumpProduct.price) * 100);
    bumpPaise = Math.min(clientBumpPaise, bumpProductPaise);
    if (!Number.isFinite(bumpPaise) || bumpPaise <= 0) {
      bumpPaise = bumpProductPaise;
    }
  }
  const amountPaise = baseNetPaise + bumpPaise;
  const netAmount = amountPaise / 100;
  const bumpAmount = bumpPaise / 100;

  // 4. Seller — lookup plan to determine effective commission
  const { data: seller } = await admin
    .from("user_profiles")
    .select("id, subscription_plan, shipping_flat_fee, free_shipping_over")
    .eq("id", page.user_id)
    .single();
  if (!seller) {
    if (couponId) await releaseCoupon(couponId, buyer_email);
    return NextResponse.json({ error: "Seller missing" }, { status: 404 });
  }

  // 4a. Shipping (physical products). Require a delivery address, then add the
  // seller's flat shipping fee — waived once the item subtotal clears the
  // seller's free-shipping threshold. Digital products skip all of this.
  let shippingPaise = 0;
  if (product.requires_shipping) {
    const addr = buyer_address_clean;
    if (!addr || !addr.line1 || !addr.city || !addr.pincode) {
      if (couponId) await releaseCoupon(couponId, buyer_email);
      return NextResponse.json(
        { error: "A delivery address (street, city, PIN) is required." },
        { status: 400 },
      );
    }
    const flatPaise = Math.round(Number(seller.shipping_flat_fee ?? 0) * 100);
    const freeOver = Number(seller.free_shipping_over ?? 0);
    const qualifiesFree =
      freeOver > 0 && baseNetPaise >= Math.round(freeOver * 100);
    shippingPaise = qualifiesFree ? 0 : Math.max(0, flatPaise);
  }
  // The buyer pays the item subtotal + shipping; the whole amount lands in the
  // seller's own gateway (no-funds model).
  const totalPaise = amountPaise + shippingPaise;
  const shippingFee = shippingPaise / 100;

  // No-funds model (Session 3): InvoxAI holds NO money. Every order is created
  // on the SELLER's OWN gateway — the full amount lands in the seller's account
  // and InvoxAI's only revenue is the per-order wallet fee (migration 040). A
  // seller who hasn't connected a gateway cannot accept payments (no platform
  // collect/escrow path exists anymore).
  const keys = await loadSellerGatewayKeys(seller.id);
  if (!keys || !isLiveGateway(keys.gateway_type)) {
    if (couponId) await releaseCoupon(couponId, buyer_email);
    return NextResponse.json(
      {
        error:
          "This store can't accept payments yet — the seller hasn't connected a payment gateway.",
      },
      { status: 402 },
    );
  }
  const gatewayOwner: "seller" = "seller";
  const planKey = (seller.subscription_plan ?? "free") as PlanKey;
  // Seller's own gateway → no platform commission split; the full amount is the
  // seller's. InvoxAI earns via the wallet fee, not a cut of the sale.
  const commissionPct = 0;
  const commissionPaise = 0;
  const sellerAmountPaise = totalPaise;
  const commissionAmount = 0;
  const sellerAmount = sellerAmountPaise / 100;

  // 4c. Wallet-balance gate (admin toggle, default off). Block checkout when the
  //     seller's wallet can't cover the per-order platform fee — same resolver
  //     the post-payment deduction uses, so the gate and the charge agree.
  if (await getRequireWalletBalance()) {
    const pg = page as {
      type?: string | null;
      template_id?: string | null;
      fee_category?: string | null;
    };
    const feeCategory = feeCategoryForPage({
      type: pg.type ?? null,
      template_id: pg.template_id ?? null,
      fee_category: pg.fee_category ?? null,
    });
    const feeCfg = await getFeeConfig();
    const feePaise =
      resolvePlatformFeePaise(
        { plan: planKey, feeCategory, orderAmountPaise: amountPaise },
        feeCfg,
      ) ?? getWalletFeePaise(planKey);
    if (feePaise > 0) {
      // Wallet must cover the fee plus the GST charged on it (matches the debit).
      const duePaise =
        feePaise + gstOnFeePaise(feePaise, gstPercentFromConfig(feeCfg));
      const { data: w } = await admin
        .from("seller_wallets")
        .select("balance_paise")
        .eq("seller_user_id", seller.id)
        .maybeSingle();
      if (Number(w?.balance_paise ?? 0) < duePaise) {
        if (couponId) await releaseCoupon(couponId, buyer_email);
        return NextResponse.json(
          {
            error:
              "This store is temporarily unavailable. Please try again later.",
          },
          { status: 402 },
        );
      }
    }
  }

  // 5. Allocate an internal order id up front so Razorpay's `receipt` and
  //    our DB row share it (and so we can pass it through `notes`).
  const orderId = crypto.randomUUID();
  const shortReceipt = nanoid(10);

  // 6. Provider order — created on the SELLER's own gateway via the
  //    provider-agnostic driver (Razorpay, Cashfree, …). The seller is the
  //    merchant of record; no Route transfer, no platform escrow.
  const sharedNotes = {
    invoxai_order_id: orderId,
    invoxai_page_id: page_id,
    invoxai_product_id: product_id,
    invoxai_seller_id: seller.id,
    invoxai_bump_amount: String(bumpAmount),
    buyer_email,
  };
  let providerOrder: {
    providerOrderId: string;
    client: Record<string, unknown>;
  } | null = null;
  try {
    const result = await getGateway(keys.gateway_type).createOrder(keys, {
      amountPaise: totalPaise,
      currency,
      receipt: shortReceipt,
      notes: sharedNotes,
      customer: {
        name: buyer_name ?? undefined,
        email: buyer_email,
        phone: buyer_phone ?? undefined,
      },
    });
    providerOrder = { providerOrderId: result.providerOrderId, client: result.client };
  } catch (err) {
    if (couponId) await releaseCoupon(couponId, buyer_email);
    // Log the real gateway error server-side; never surface its text to the
    // browser (it can leak account IDs, internal flags, etc.).
    console.error("[create-order] gateway createOrder failed", err);
    return NextResponse.json(
      { error: "Payment gateway is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  // 7. Persist a pending order
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error: insertErr } = await admin.from("orders").insert({
    id: orderId,
    page_id,
    seller_user_id: page.user_id,
    product_id,
    buyer_email,
    buyer_name: buyer_name ?? null,
    buyer_phone: buyer_phone ?? null,
    amount: totalPaise / 100,
    shipping_fee: shippingFee,
    shipping_address: product.requires_shipping ? buyer_address_clean : null,
    platform_commission: commissionAmount,
    seller_amount: sellerAmount,
    currency,
    status: "pending",
    payment_gateway: keys.gateway_type,
    gateway_owner: gatewayOwner,
    gateway_order_id: providerOrder.providerOrderId,
    coupon_id: couponId,
    discount_amount: discountAmount,
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
    ip_address: ip,
    bump_offered,
    bump_accepted,
    bump_product_id: bumpProduct?.id ?? null,
    bump_amount: bumpAmount > 0 ? bumpAmount : null,
    bump_title: bumpProduct?.name ?? null,
    buyer_gstin,
    buyer_state_code,
    buyer_address: buyer_address_clean,
    custom_fields: custom_fields_clean,
  });
  if (insertErr) {
    console.error("orders insert failed", insertErr);
  } else {
    // Score the order for abuse/fraud signals and flag for admin review if it
    // crosses the threshold. Best-effort, non-blocking — never delays checkout.
    void evaluateAndFlagOrder({
      orderId,
      sellerUserId: page.user_id,
      email: buyer_email,
      ip,
      amountInr: totalPaise / 100,
      productId: product_id,
    });
  }

  // 7b. If bump accepted, insert the bump as a separate child order row
  // (source='bump', parent_order_id=main). Shares the same Razorpay order id
  // so the buyer makes a single payment.
  if (bumpPaise > 0 && bumpProduct) {
    const bumpCommissionPaise = Math.round((bumpPaise * commissionPct) / 100);
    const bumpSellerPaise = bumpPaise - bumpCommissionPaise;
    await admin.from("orders").insert({
      page_id,
      seller_user_id: page.user_id,
      product_id: bumpProduct.id,
      parent_order_id: orderId,
      source: "bump",
      buyer_email,
      buyer_name: buyer_name ?? null,
      buyer_phone: buyer_phone ?? null,
      amount: bumpPaise / 100,
      platform_commission: bumpCommissionPaise / 100,
      seller_amount: bumpSellerPaise / 100,
      currency,
      status: "pending",
      payment_gateway: keys.gateway_type,
      gateway_owner: gatewayOwner,
      gateway_order_id: providerOrder.providerOrderId,
      ip_address: ip,
    });
  }

  // 8. Record an abandoned_checkout immediately (marked recovered on success)
  await admin.from("abandoned_checkouts").insert({
    page_id,
    seller_user_id: page.user_id,
    buyer_email,
    buyer_phone: buyer_phone ?? null,
    buyer_name: buyer_name ?? null,
    amount: netAmount,
    status: "active",
    recovery_token: nanoid(24),
    token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({
    ok: true,
    gateway: keys.gateway_type,
    order_id: orderId,
    amount: totalPaise,
    shipping_fee: shippingFee,
    currency,
    name: "InvoxAI",
    description: product.name,
    buyer_name: buyer_name ?? "",
    buyer_email,
    buyer_phone: buyer_phone ?? "",
    discount_amount: discountAmount,
    gross_amount: grossAmount,
    // Razorpay: the browser opens Razorpay Checkout with the seller's key id.
    razorpay_order_id:
      keys.gateway_type === "razorpay" ? providerOrder.providerOrderId : undefined,
    key: keys.gateway_type === "razorpay" ? keys.key_id : undefined,
    // Cashfree: the browser opens the Cashfree SDK with this payment session.
    cashfree:
      keys.gateway_type === "cashfree" ? providerOrder.client : undefined,
  });
}
