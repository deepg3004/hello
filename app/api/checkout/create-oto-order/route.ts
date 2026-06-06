// POST /api/checkout/create-oto-order
//
// Reads the OTO cookie set by verify-payment, validates that the parent order
// is paid and the OTO config matches, creates a child orders row (source='oto',
// parent_order_id = parent) and a fresh Razorpay order. Returns the same shape
// as /api/checkout/create-order so the OTO page can launch Razorpay Checkout.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSellerGatewayOrder,
  gatewayClientFields,
} from "@/lib/checkout-gateway";
import { walletCoversPlatformFee } from "@/lib/order-fulfillment";
import { verifyOtoToken, OTO_COOKIE_NAME } from "@/lib/oto-token";

interface OtoConfig {
  enabled?: boolean;
  product_id?: string;
  price?: number;
  headline?: string;
}

export async function POST() {
  const jar = cookies();
  const token = jar.get(OTO_COOKIE_NAME)?.value;
  const payload = token ? verifyOtoToken(token) : null;
  if (!payload) {
    return NextResponse.json(
      { error: "OTO link expired. Refresh the page." },
      { status: 401 },
    );
  }

  const admin = createAdminClient();

  // Single-use enforcement — claim the jti BEFORE we do any work. PK conflict
  // on oto_token_consumed means a previous request already redeemed this
  // exact cookie; we must reject so a buyer can't replay the OTO offer and
  // create unlimited child orders against the same parent.
  const { error: claimErr } = await admin
    .from("oto_token_consumed")
    .insert({ jti: payload.jti, parent_order_id: payload.order_id });
  if (claimErr) {
    return NextResponse.json(
      { error: "This offer has already been redeemed." },
      { status: 409 },
    );
  }

  // Load parent order + page + OTO config.
  const { data: parent } = await admin
    .from("orders")
    .select(
      "id, buyer_email, buyer_name, buyer_phone, status, page_id, seller_user_id, source",
    )
    .eq("id", payload.order_id)
    .single();
  if (!parent || parent.status !== "paid") {
    return NextResponse.json({ error: "Parent order not paid" }, { status: 400 });
  }
  if (parent.source === "oto") {
    return NextResponse.json({ error: "Nested OTOs are not allowed" }, { status: 400 });
  }

  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, slug, status, page_config")
    .eq("id", payload.page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Page is not available" }, { status: 404 });
  }

  const oto = ((page.page_config as { oto_config?: OtoConfig } | null) ?? {}).oto_config ?? null;
  if (!oto?.enabled || !oto.product_id) {
    return NextResponse.json({ error: "OTO is not active" }, { status: 400 });
  }

  // Validate OTO product against the seller.
  const { data: product } = await admin
    .from("products")
    .select("id, user_id, name, price, currency, active")
    .eq("id", oto.product_id)
    .single();
  if (!product || product.user_id !== page.user_id || !product.active) {
    return NextResponse.json({ error: "OTO product unavailable" }, { status: 404 });
  }

  // Resolve OTO price — seller override <= product price.
  const priceOverride =
    typeof oto.price === "number" && oto.price > 0 ? Math.min(oto.price, Number(product.price)) : Number(product.price);
  if (!Number.isFinite(priceOverride) || priceOverride <= 0) {
    return NextResponse.json({ error: "OTO price misconfigured" }, { status: 400 });
  }

  // Seller — must have their OWN gateway connected (no-funds model, Session 3).
  const { data: seller } = await admin
    .from("user_profiles")
    .select("id, subscription_plan")
    .eq("id", page.user_id)
    .single();
  if (!seller) {
    return NextResponse.json({ error: "Seller missing" }, { status: 404 });
  }

  // No-funds model: the OTO is created on the SELLER's own gateway (any
  // supported provider) via the driver. A seller without a gateway can't sell.
  const gatewayOwner: "seller" = "seller";
  // Seller's own gateway → full amount is the seller's; no commission split.
  const amountPaise = Math.round(priceOverride * 100);
  const commission = 0;
  const sellerAmount = amountPaise / 100;

  const otoOrderId = crypto.randomUUID();
  const otoCurrency = product.currency ?? "INR";
  const otoNotes = {
    invoxai_order_id: otoOrderId,
    invoxai_page_id: page.id,
    invoxai_parent_order: parent.id,
    invoxai_seller_id: seller.id,
    kind: "oto",
  };
  if (
    !(await walletCoversPlatformFee(
      { sellerUserId: seller.id, orderAmountPaise: amountPaise },
      admin,
    ))
  ) {
    return NextResponse.json(
      { error: "This store is temporarily unavailable. Please try again later." },
      { status: 402 },
    );
  }

  const gw = await createSellerGatewayOrder(seller.id, {
    amountPaise,
    currency: otoCurrency,
    receipt: nanoid(10),
    notes: otoNotes,
    customer: {
      name: parent.buyer_name ?? undefined,
      email: parent.buyer_email,
      phone: parent.buyer_phone ?? undefined,
    },
  });
  if (!gw.ok) {
    return NextResponse.json({ error: gw.error }, { status: gw.status });
  }

  await admin.from("orders").insert({
    id: otoOrderId,
    page_id: page.id,
    seller_user_id: page.user_id,
    product_id: product.id,
    parent_order_id: parent.id,
    source: "oto",
    buyer_email: parent.buyer_email,
    buyer_name: parent.buyer_name,
    buyer_phone: parent.buyer_phone,
    amount: priceOverride,
    platform_commission: commission,
    seller_amount: sellerAmount,
    currency: otoCurrency,
    status: "pending",
    payment_gateway: gw.gateway,
    gateway_owner: gatewayOwner,
    gateway_order_id: gw.providerOrderId,
  });

  // Mark the parent as having accepted the OTO offer.
  await admin
    .from("orders")
    .update({ oto_accepted: true })
    .eq("id", parent.id);

  return NextResponse.json({
    ok: true,
    ...gatewayClientFields(gw.gateway, gw.providerOrderId, gw.client),
    order_id: otoOrderId,
    amount: amountPaise,
    currency: otoCurrency,
    name: "InvoxAI",
    description: product.name,
    buyer_name: parent.buyer_name ?? "",
    buyer_email: parent.buyer_email,
    buyer_phone: parent.buyer_phone ?? "",
  });
}
