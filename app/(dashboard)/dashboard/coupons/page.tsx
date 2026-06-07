import { redirect } from "next/navigation";

import { CouponsTable, type CouponRow } from "@/components/dashboard/coupons/CouponsTable";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { dailySeries, seriesTrend } from "@/lib/dashboard/spark";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const ctx = await requirePageActor("coupons.view", "/dashboard/coupons");

  const admin = createAdminClient();
  const [{ data: couponsRaw }, { data: pages }, { data: couponOrdersRaw }] =
    await Promise.all([
      admin
        .from("coupons")
        .select(
          "id, code, discount_type, discount_value, min_order, max_discount, total_limit, per_customer_limit, usage_count, starts_at, expires_at, page_ids, active, show_at_checkout, created_at",
        )
        .eq("user_id", ctx.ownerId)
        .order("created_at", { ascending: false }),
      admin
        .from("pages")
        .select("id, title")
        .eq("user_id", ctx.ownerId)
        .order("created_at", { ascending: false }),
      // Orders that redeemed a coupon — drives discount-given + sparklines.
      admin
        .from("orders")
        .select("discount_amount, status, created_at")
        .eq("seller_user_id", ctx.ownerId)
        .not("coupon_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

  const coupons = (couponsRaw ?? []).map((c) => ({
    ...c,
    discount_value: Number(c.discount_value ?? 0),
    min_order: Number(c.min_order ?? 0),
    max_discount: c.max_discount != null ? Number(c.max_discount) : null,
    total_limit: c.total_limit != null ? Number(c.total_limit) : null,
    per_customer_limit: Number(c.per_customer_limit ?? 1),
    usage_count: Number(c.usage_count ?? 0),
    page_ids: Array.isArray(c.page_ids) ? (c.page_ids as string[]) : [],
  })) as CouponRow[];

  // ── Headline stats ───────────────────────────────────────────────────
  const couponOrders = (couponOrdersRaw ?? []) as Array<{
    discount_amount: number | null;
    status: string;
    created_at: string;
  }>;
  const activeCoupons = coupons.filter((c) => c.active).length;
  const totalRedemptions = coupons.reduce((a, c) => a + c.usage_count, 0);
  const discountGiven = couponOrders
    .filter((o) => o.status === "paid")
    .reduce((a, o) => a + Number(o.discount_amount ?? 0), 0);
  const sparkRedemptions = dailySeries(couponOrders, (o) => o.created_at);
  const sparkDiscount = dailySeries(
    couponOrders.filter((o) => o.status === "paid"),
    (o) => o.created_at,
    (o) => Number(o.discount_amount ?? 0),
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Coupons"
        blurb="Discount codes buyers enter at checkout. Validation is server-side with an atomic counter — no oversells."
        gradient="from-emerald-600 via-teal-600 to-green-600"
      />

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard
          label="Active Coupons"
          value={activeCoupons.toLocaleString("en-IN")}
          trendPct={null}
          spark={sparkRedemptions}
          color="#6366f1"
        />
        <PageStatCard
          label="Redemptions"
          value={totalRedemptions.toLocaleString("en-IN")}
          trendPct={seriesTrend(sparkRedemptions)}
          spark={sparkRedemptions}
          color="#10b981"
        />
        <PageStatCard
          label="Discount Given"
          value={formatINR(discountGiven * 100)}
          trendPct={seriesTrend(sparkDiscount)}
          spark={sparkDiscount}
          color="#f59e0b"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <CouponsTable coupons={coupons} pages={pages ?? []} />
      </div>
    </div>
  );
}
