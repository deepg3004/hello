import { redirect } from "next/navigation";

import { CustomersClient, type Customer } from "@/components/dashboard/CustomersClient";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { dailySeries, seriesTrend } from "@/lib/dashboard/spark";
import { formatINR } from "@/lib/utils";

const HERO_BTN =
  "border-border bg-card text-foreground hover:bg-muted";

export const metadata = { title: "Customers" };

interface OrderRow {
  id: string;
  buyer_name: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  amount: number;
  status: string;
  created_at: string;
  pages: { title: string } | { title: string }[] | null;
}

export default async function CustomersPage() {
  const ctx = await requirePageActor("customers.view", "/dashboard/customers");

  const admin = createAdminClient();
  const { data: ordersRaw } = await admin
    .from("orders")
    .select("id, buyer_name, buyer_email, buyer_phone, amount, status, created_at, pages(title)")
    .eq("seller_user_id", ctx.ownerId)
    .order("created_at", { ascending: true })
    .limit(5000);

  const orders = (ordersRaw ?? []) as unknown as OrderRow[];

  // Aggregate by buyer_email
  const map = new Map<string, Customer>();
  for (const o of orders) {
    const email = o.buyer_email.toLowerCase();
    const page = Array.isArray(o.pages) ? o.pages[0] : o.pages;
    const existing = map.get(email);
    const order = {
      id: o.id,
      amount: Number(o.amount ?? 0),
      status: o.status,
      created_at: o.created_at,
      page_title: page?.title ?? null,
    };
    if (!existing) {
      map.set(email, {
        email: o.buyer_email,
        name: o.buyer_name,
        phone: o.buyer_phone,
        total_orders: 1,
        total_spent: o.status === "paid" ? Number(o.amount ?? 0) : 0,
        last_purchase_at: o.created_at,
        first_page_title: page?.title ?? null,
        orders: [order],
      });
    } else {
      existing.total_orders += 1;
      if (o.status === "paid") existing.total_spent += Number(o.amount ?? 0);
      existing.last_purchase_at = o.created_at;
      // Keep latest known non-null name/phone
      if (!existing.name && o.buyer_name) existing.name = o.buyer_name;
      if (!existing.phone && o.buyer_phone) existing.phone = o.buyer_phone;
      existing.orders.push(order);
    }
  }

  // Sort customers by total spent desc, sort each customer's orders desc
  const customers = Array.from(map.values())
    .map((c) => ({ ...c, orders: c.orders.slice().reverse() }))
    .sort((a, b) => b.total_spent - a.total_spent);

  // ── Headline stats ───────────────────────────────────────────────────
  const totalCustomers = customers.length;
  const repeatBuyers = customers.filter((c) => c.total_orders > 1).length;
  const totalSpend = customers.reduce((a, c) => a + c.total_spent, 0);
  const avgLTV = totalCustomers ? totalSpend / totalCustomers : 0;
  // `orders` is ascending — the first time we see an email is acquisition day.
  const seen = new Set<string>();
  const firstSeen: { created_at: string }[] = [];
  for (const o of orders) {
    const e = o.buyer_email.toLowerCase();
    if (!seen.has(e)) {
      seen.add(e);
      firstSeen.push({ created_at: o.created_at });
    }
  }
  const sparkNew = dailySeries(firstSeen, (r) => r.created_at);
  const sparkSpend = dailySeries(
    orders.filter((o) => o.status === "paid"),
    (o) => o.created_at,
    (o) => Number(o.amount ?? 0),
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Customers"
        blurb="Everyone who's ever bought from you. Sorted by total spent."
        gradient="from-violet-600 via-purple-600 to-fuchsia-600"
      >
        <ExportCsvButton type="customers" className={HERO_BTN} />
      </DashboardHero>

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard
          label="Total Customers"
          value={totalCustomers.toLocaleString("en-IN")}
          trendPct={seriesTrend(sparkNew)}
          spark={sparkNew}
          color="#6366f1"
        />
        <PageStatCard
          label="Repeat Buyers"
          value={repeatBuyers.toLocaleString("en-IN")}
          trendPct={null}
          spark={sparkNew}
          color="#8b5cf6"
        />
        <PageStatCard
          label="Total Spend"
          value={formatINR(totalSpend * 100)}
          trendPct={seriesTrend(sparkSpend)}
          spark={sparkSpend}
          color="#10b981"
        />
        <PageStatCard
          label="Avg LTV"
          value={formatINR(avgLTV * 100)}
          trendPct={null}
          spark={sparkSpend}
          color="#f59e0b"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <CustomersClient customers={customers} />
      </div>
    </div>
  );
}
