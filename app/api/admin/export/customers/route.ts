// GET /api/admin/export/customers — platform-wide buyers CSV (admin). Mirrors
// the /admin/customers aggregation (by email, latest 10k orders) for operator
// reporting / reconciliation.

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const esc = (s: unknown): string => {
  const v = s == null ? "" : String(s);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("buyer_email, buyer_name, buyer_phone, amount, status, seller_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  const byEmail = new Map<string, Agg>();
  for (const o of (data ?? []) as Array<Record<string, unknown>>) {
    const email = String(o.buyer_email ?? "").toLowerCase();
    if (!email) continue;
    let a = byEmail.get(email);
    if (!a) {
      a = {
        email,
        name: (o.buyer_name as string) ?? null,
        phone: (o.buyer_phone as string) ?? null,
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

  const header = ["email", "name", "phone", "orders", "paid_orders", "total_paid", "sellers", "last_order_at"];
  const lines = [header.join(",")];
  for (const a of [...byEmail.values()].sort((x, y) => y.totalPaid - x.totalPaid)) {
    lines.push(
      [a.email, a.name ?? "", a.phone ?? "", a.orders, a.paidOrders, a.totalPaid, a.sellers.size, a.lastOrderAt]
        .map(esc)
        .join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="invoxai-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
