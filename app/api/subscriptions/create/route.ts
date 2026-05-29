// POST /api/subscriptions/create
//
// Body: { plan: PlanKey, user_id: string, email: string }
//
// 1. Looks up the seller in user_profiles.
// 2. Creates or reuses a Razorpay customer.
// 3. Creates a Razorpay subscription for the plan.
// 4. Persists razorpay_customer_id on the user profile.
// 5. Returns { redirect_url } pointing at the Razorpay hosted page.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay } from "@/lib/razorpay";
import { PLANS, type PlanKey } from "@/lib/plans";

const ALLOWED_PLANS: PlanKey[] = ["starter", "pro", "business"];

export async function POST(request: Request) {
  let body: { plan?: PlanKey; user_id?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { plan, user_id, email } = body;
  if (!plan || !user_id || !email) {
    return NextResponse.json(
      { error: "plan, user_id and email are required" },
      { status: 400 },
    );
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

  // 1. Load profile
  const { data: profile, error: profileErr } = await admin
    .from("user_profiles")
    .select("id, email, full_name, phone, razorpay_customer_id")
    .eq("id", user_id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
  }

  const razorpay = getRazorpay();

  // 2. Customer
  let customerId = profile.razorpay_customer_id as string | null;
  if (!customerId) {
    try {
      const customer = await razorpay.customers.create({
        name: profile.full_name ?? email,
        email: profile.email ?? email,
        contact: profile.phone ?? undefined,
        fail_existing: 0, // reuse if it already exists for this email
      });
      customerId = customer.id;
      await admin
        .from("user_profiles")
        .update({ razorpay_customer_id: customerId })
        .eq("id", user_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Razorpay customer error";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // 3. Subscription
  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planConfig.razorpay_plan_id,
      customer_notify: 1,
      total_count: 120, // 10 years monthly — effectively "until cancelled"
      quantity: 1,
      notes: {
        invoxai_user_id: user_id,
        invoxai_plan: plan,
      },
    });

    // Cache the pending subscription in our DB so the webhook can attribute it.
    await admin.from("user_subscriptions").insert({
      user_id,
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
