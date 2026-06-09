// Admin · Customers (Session 16) — platform-wide buyers, aggregated from orders
// by email. Read-only oversight; capped at the latest 10k orders.

import { Download } from "lucide-react";

import {
  AdminCustomersClient,
  type AdminCustomerRow,
} from "@/components/admin/AdminCustomersClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Customers" };

interface Agg {
  email: string;
  name: string | null;
  phone: string | null;
  orders: number;
  paidOrders: number;
  totalPaid: number;
  sellers: Set<string>;
  lastOrderAt: string;
}

export default async function AdminCustomersPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("buyer_email, buyer_name, buyer_phone, amount, status, seller_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  const byEmail = new Map<string, Agg>();
  for (const o of data ?? []) {
    const email = (o.buyer_email ?? "").toLowerCase();
    if (!email) continue;
    let a = byEmail.get(email);
    if (!a) {
      // Orders are newest-first, so the first row we see carries the freshest
      // name/phone and the most recent order date.
      a = {
        email,
        name: o.buyer_name ?? null,
        phone: o.buyer_phone ?? null,
        orders: 0,
        paidOrders: 0,
        totalPaid: 0,
        sellers: new Set(),
        lastOrderAt: o.created_at as string,
      };
      byEmail.set(email, a);
    }
    a.orders += 1;
    if (o.seller_user_id) a.sellers.add(o.seller_user_id as string);
    if (o.status === "paid") {
      a.paidOrders += 1;
      a.totalPaid += Number(o.amount ?? 0);
    }
  }

  const rows: AdminCustomerRow[] = [...byEmail.values()]
    .map((a) => ({
      email: a.email,
      name: a.name,
      phone: a.phone,
      orders: a.orders,
      paidOrders: a.paidOrders,
      totalPaid: a.totalPaid,
      sellerCount: a.sellers.size,
      lastOrderAt: a.lastOrderAt,
    }))
    .sort((x, y) => y.totalPaid - x.totalPaid);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Customers"
        blurb="Every buyer across the platform, aggregated by email from the latest 10k orders."
        resourcesHref={null}
      >
        <a
          href="/api/admin/export/customers"
          download
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </a>
      </DashboardHero>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminCustomersClient rows={rows} />
      </div>
    </div>
  );
}
