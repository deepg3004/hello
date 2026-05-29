import Link from "next/link";
import { startOfMonth, startOfWeek, startOfDay } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey } from "@/lib/plans";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Overview" };

const rupees = (n: number) => formatINR(n * 100);

export default async function AdminOverview() {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const todayStart = startOfDay(now).toISOString();

  const [
    { data: paidThisMonth },
    { data: subsRaw },
    { count: signupsToday },
    { count: signupsThisWeek },
    { count: failedToday },
    { count: kycPending },
    { count: kycReview },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("amount, platform_commission")
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    admin
      .from("user_profiles")
      .select("subscription_plan, subscription_status, created_at"),
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", todayStart),
    admin
      .from("kyc_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("kyc_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "under_review"),
  ]);

  const gmv = (paidThisMonth ?? []).reduce(
    (acc, r) => acc + Number(r.amount ?? 0),
    0,
  );
  const commission = (paidThisMonth ?? []).reduce(
    (acc, r) => acc + Number(r.platform_commission ?? 0),
    0,
  );

  const subs = (subsRaw ?? []) as Array<{
    subscription_plan: string | null;
    subscription_status: string | null;
    created_at: string;
  }>;

  // Active subscribers per plan
  const activeByPlan: Record<PlanKey, number> = {
    free: 0,
    starter: 0,
    pro: 0,
    business: 0,
  };
  let mrr = 0;
  let churnedThisMonth = 0;
  for (const s of subs) {
    const planKey = ((s.subscription_plan ?? "free") in PLANS
      ? s.subscription_plan
      : "free") as PlanKey;
    const status = s.subscription_status ?? "inactive";
    if (status === "active" || status === "trialing") {
      activeByPlan[planKey] = (activeByPlan[planKey] ?? 0) + 1;
      mrr += PLANS[planKey].price;
    }
    if (status === "cancelled" && new Date(s.created_at) >= new Date(monthStart)) {
      churnedThisMonth++;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Live numbers across every seller and order on InvoxAI.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="MRR" value={rupees(mrr)} hint="From active subscriptions" />
        <MetricCard label="GMV this month" value={rupees(gmv)} />
        <MetricCard label="Commission earned" value={rupees(commission)} />
        <MetricCard label="Churn this month" value={churnedThisMonth.toLocaleString("en-IN")} />
        <MetricCard label="Signups today" value={(signupsToday ?? 0).toLocaleString("en-IN")} />
        <MetricCard label="Signups this week" value={(signupsThisWeek ?? 0).toLocaleString("en-IN")} />
        <MetricCard label="Failed payments today" value={(failedToday ?? 0).toLocaleString("en-IN")} />
        <MetricCard
          label="KYC queue"
          value={((kycPending ?? 0) + (kycReview ?? 0)).toLocaleString("en-IN")}
          hint={`${kycPending ?? 0} pending · ${kycReview ?? 0} under review`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active subscribers by plan</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(Object.keys(activeByPlan) as PlanKey[]).map((plan) => (
              <li key={plan} className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {PLANS[plan].name}
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {activeByPlan[plan].toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground">
                  ₹{(activeByPlan[plan] * PLANS[plan].price).toLocaleString("en-IN")}/mo
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/kyc" className="rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted">
            Review KYC queue ({(kycPending ?? 0) + (kycReview ?? 0)})
          </Link>
          <Link href="/admin/transactions" className="rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted">
            See failed payments ({failedToday ?? 0} today)
          </Link>
          <Link href="/admin/users" className="rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted">
            Manage users
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
