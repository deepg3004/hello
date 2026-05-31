// POST /api/subscriptions/create
//
// Body: { plan: PlanKey }
//
// AUTH (SECURITY): requires a logged-in seller. The user_id and email are
// always resolved from the Supabase session — NEVER from the request body.
// Previously this route trusted body.user_id, letting any unauthenticated
// caller create Razorpay subscriptions on behalf of any other user.
//
// 1. Verify session → seller user.
// 2. Look up the seller in user_profiles (defensive, never trust client).
// 3. Create or reuse a Razorpay customer.
// 4. Create a Razorpay subscription for the plan.
// 5. Persist razorpay_customer_id on the user profile.
// 6. Return { redirect_url } pointing at the Razorpay hosted page.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRazorpay } from "@/lib/razorpay";
import { PLANS, type PlanKey } from "@/lib/plans";

const ALLOWED_PLANS: PlanKey[] = ["starter", "pro", "business"];

export async function POST(request: Request) {
  // ── 1. AuthN — the only acceptable source for user_id ────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // ── 2. Body — only `plan` is read from the request now ───────────────────
  let body: { plan?: PlanKey };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { plan } = body;
  if (!plan) {
    return NextResponse.json({ error: "plan is required" }, { status: 400 });
  }
  if (!ALLOWED_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Plan is not purchasable" }, { status: 400 });
  }

  const planConfig = PLANS[plan];
  if (!planConfig.razorpay_plan_id) {
    return NextResponse.json(
      {
        error:
          "This plan is not yet wired up in Razorpay. Set razorpay_plan_id in lib/plans.ts.",
      },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  // ── 3. Load profile under the authenticated user_id ──────────────────────
  const userId = user.id;
  const { data: profile, error: profileErr } = await admin
    .from("user_profiles")
    .select("id, email, full_name, phone, razorpay_customer_id")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
  }

  // Email is always the session email — body.email was a forgery vector.
  const email = profile.email ?? user.email;
  if (!email) {
    return NextResponse.json(
      { error: "Account email missing — contact support." },
      { status: 400 },
    );
  }

  const razorpay = getRazorpay();

  // ── 4. Customer ──────────────────────────────────────────────────────────
  let customerId = profile.razorpay_customer_id as string | null;
  if (!customerId) {
    try {
      const customer = await razorpay.customers.create({
        name: profile.full_name ?? email,
        email,
        contact: profile.phone ?? undefined,
        fail_existing: 0, // reuse if it already exists for this email
      });
      customerId = customer.id;
      await admin
        .from("user_profiles")
        .update({ razorpay_customer_id: customerId })
        .eq("id", userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Razorpay customer error";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // ── 5. Subscription ──────────────────────────────────────────────────────
  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planConfig.razorpay_plan_id,
      customer_notify: 1,
      total_count: 120, // 10 years monthly — effectively "until cancelled"
      quantity: 1,
      notes: {
        invoxai_user_id: userId,
        invoxai_plan: plan,
      },
    });

    // Cache the pending subscription so the webhook can attribute it.
    await admin.from("user_subscriptions").insert({
      user_id: userId,
      plan,
      status: "created",
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: planConfig.razorpay_plan_id,
      amount: planConfig.price,
    });

    const redirectUrl =
      (subscription as unknown as { short_url?: string }).short_url ??
      `https://api.razorpay.com/v1/subscriptions/${subscription.id}`;

    return NextResponse.json({
      ok: true,
      subscription_id: subscription.id,
      redirect_url: redirectUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay subscription error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
