// GET /api/admin/export/transactions — platform-wide transactions CSV (admin).
// The seller export (/api/export/orders.csv) is scoped to one seller; operators
// need an all-seller export for reconciliation/reporting.

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
    .select(
      "id, created_at, paid_at, status, buyer_email, buyer_name, amount, seller_amount, platform_commission, currency, payment_gateway, gateway_owner, gateway_payment_id, seller_user_id, user_profiles!orders_seller_user_id_fkey(full_name, email), pages(title)",
    )
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    created_at: string;
    paid_at: string | null;
    status: string;
    buyer_email: string;
    buyer_name: string | null;
    amount: number;
    seller_amount: number;
    platform_commission: number;
    currency: string;
    payment_gateway: string | null;
    gateway_owner: string | null;
    gateway_payment_id: string | null;
    seller_user_id: string;
    user_profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
    pages: { title: string } | { title: string }[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const header = [
    "order_id",
    "created_at",
    "paid_at",
    "status",
    "seller_name",
    "seller_email",
    "seller_user_id",
    "page_title",
    "buyer_name",
    "buyer_email",
    "amount",
    "seller_amount",
    "platform_commission",
    "currency",
    "gateway",
    "gateway_owner",
    "gateway_payment_id",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
    const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    lines.push(
      [
        r.id,
        r.created_at,
        r.paid_at ?? "",
        r.status,
        seller?.full_name ?? "",
        seller?.email ?? "",
        r.seller_user_id,
        page?.title ?? "",
        r.buyer_name ?? "",
        r.buyer_email,
        r.amount,
        r.seller_amount,
        r.platform_commission,
        r.currency,
        r.payment_gateway ?? "",
        r.gateway_owner ?? "",
        r.gateway_payment_id ?? "",
      ]
        .map(esc)
        .join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="invoxai-all-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
