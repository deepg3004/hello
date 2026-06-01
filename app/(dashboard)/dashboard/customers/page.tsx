import { redirect } from "next/navigation";

import { CustomersClient, type Customer } from "@/components/dashboard/CustomersClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: ordersRaw } = await admin
    .from("orders")
    .select("id, buyer_name, buyer_email, buyer_phone, amount, status, created_at, pages(title)")
    .eq("seller_user_id", user.id)
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

  return (
    <div className="space-y-6">
      <div
        className="animate-in-up flex flex-wrap items-start justify-between gap-3"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="font-sora text-2xl font-semibold tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">
            Everyone who&apos;s ever bought from you. Sorted by total spent.
          </p>
        </div>
        <ExportCsvButton type="customers" />
      </div>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <CustomersClient customers={customers} />
      </div>
    </div>
  );
}
