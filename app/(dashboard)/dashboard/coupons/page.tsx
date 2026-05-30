import { redirect } from "next/navigation";

import { CouponsTable, type CouponRow } from "@/components/dashboard/coupons/CouponsTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: couponsRaw }, { data: pages }] = await Promise.all([
    admin
      .from("coupons")
      .select(
        "id, code, discount_type, discount_value, min_order, max_discount, total_limit, per_customer_limit, usage_count, starts_at, expires_at, page_ids, active, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("pages")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Coupons</h1>
        <p className="text-sm text-muted-foreground">
          Build discount codes that buyers enter at checkout. Validation happens
          server-side and the counter is atomic — no oversells.
        </p>
      </div>
      <CouponsTable coupons={coupons} pages={pages ?? []} />
    </div>
  );
}
