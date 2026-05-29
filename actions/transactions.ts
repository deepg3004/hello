"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface TransactionsFilter {
  from?: string;     // ISO date
  to?: string;       // ISO date
  status?: string;   // empty = any
  page_id?: string;
  search?: string;   // buyer name or email
}

export interface ExportResult {
  ok: boolean;
  message?: string;
  csv?: string;
  filename?: string;
}

const csvEscape = (s: unknown): string => {
  const v = s == null ? "" : String(s);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
};

export async function exportTransactionsCsvAction(
  filter: TransactionsFilter,
): Promise<ExportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, amount, platform_commission, seller_amount, status, payment_gateway, gateway_payment_id, currency, coupon_id, discount_amount, utm_source, utm_medium, utm_campaign, created_at, paid_at, pages(title, slug)",
    )
    .eq("seller_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (filter.from) query = query.gte("created_at", filter.from);
  if (filter.to) query = query.lte("created_at", filter.to);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.page_id) query = query.eq("page_id", filter.page_id);
  if (filter.search) {
    const s = `%${filter.search}%`;
    query = query.or(`buyer_name.ilike.${s},buyer_email.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    buyer_name: string | null;
    buyer_email: string;
    buyer_phone: string | null;
    amount: number;
    platform_commission: number;
    seller_amount: number;
    status: string;
    payment_gateway: string | null;
    gateway_payment_id: string | null;
    currency: string;
    discount_amount: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    created_at: string;
    paid_at: string | null;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>;

  const header = [
    "order_id",
    "created_at",
    "paid_at",
    "page_title",
    "page_slug",
    "buyer_name",
    "buyer_email",
    "buyer_phone",
    "amount",
    "platform_commission",
    "seller_amount",
    "discount",
    "currency",
    "status",
    "gateway",
    "gateway_payment_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    lines.push(
      [
        r.id,
        r.created_at,
        r.paid_at ?? "",
        page?.title ?? "",
        page?.slug ?? "",
        r.buyer_name ?? "",
        r.buyer_email,
        r.buyer_phone ?? "",
        r.amount,
        r.platform_commission,
        r.seller_amount,
        r.discount_amount ?? 0,
        r.currency,
        r.status,
        r.payment_gateway ?? "",
        r.gateway_payment_id ?? "",
        r.utm_source ?? "",
        r.utm_medium ?? "",
        r.utm_campaign ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return {
    ok: true,
    csv: lines.join("\n"),
    filename: `invoxai-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export interface RefundResult {
  ok: boolean;
  message?: string;
}

/** Admin-only stub. Real refund flow lands in a later prompt. */
export async function refundOrderAction(orderId: string): Promise<RefundResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return { ok: false, message: "Refunds are admin-only for now" };
  }

  await admin.from("orders").update({ status: "refunded" }).eq("id", orderId);
  return { ok: true };
}
