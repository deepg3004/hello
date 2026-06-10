import { redirect } from "next/navigation";

import { format, subMonths } from "date-fns";

import {
  TransactionsClient,
  type PageOption,
  type TransactionRow,
} from "@/components/dashboard/TransactionsClient";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  EarningsCard,
  type EarningsPoint,
} from "@/components/dashboard/EarningsCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";

const HERO_BTN =
  "border-border bg-card text-foreground hover:bg-muted";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const ctx = await requirePageActor("transactions.view", "/dashboard/transactions");

  const admin = createAdminClient();
  const [{ data: rowsRaw }, { data: pagesRaw }, { data: profile }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, buyer_name, buyer_email, buyer_phone, buyer_address, amount, platform_commission, seller_amount, status, payment_gateway, gateway_payment_id, coupon_id, discount_amount, utm_source, utm_medium, utm_campaign, created_at, refund_request_status, refund_request_reason, pages(title, slug)",
      )
      .eq("seller_user_id", ctx.ownerId)
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("pages")
      .select("id, title")
      .eq("user_id", ctx.ownerId)
      .order("created_at", { ascending: false }),
    admin
      .from("user_profiles")
      .select("is_admin")
      .eq("id", ctx.ownerId)
      .single(),
  ]);

  type RawOrder = {
    id: string;
    buyer_name: string | null;
    buyer_email: string;
    buyer_phone: string | null;
    buyer_address: Record<string, unknown> | null;
    amount: number;
    platform_commission: number;
    seller_amount: number;
    status: string;
    payment_gateway: string | null;
    gateway_payment_id: string | null;
    coupon_id: string | null;
    discount_amount: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    created_at: string;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  };
  const rawOrders = (rowsRaw ?? []) as unknown as RawOrder[];

  // Resolve coupon codes for any orders that used one.
  const couponIds = Array.from(
    new Set(rawOrders.map((r) => r.coupon_id).filter(Boolean)),
  ) as string[];
  const couponMap = new Map<string, string>();
  if (couponIds.length) {
    const { data: cps } = await admin.from("coupons").select("id, code").in("id", couponIds);
    for (const c of (cps ?? []) as Array<{ id: string; code: string }>) couponMap.set(c.id, c.code);
  }

  const rows: TransactionRow[] = rawOrders.map((r) => {
    const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    return {
      id: r.id,
      buyer_name: r.buyer_name,
      buyer_email: r.buyer_email,
      buyer_phone: r.buyer_phone,
      buyer_address: r.buyer_address,
      amount: Number(r.amount ?? 0),
      platform_commission: Number(r.platform_commission ?? 0),
      seller_amount: Number(r.seller_amount ?? 0),
      status: r.status,
      payment_gateway: r.payment_gateway,
      gateway_payment_id: r.gateway_payment_id,
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      page_title: page?.title ?? null,
      page_slug: page?.slug ?? null,
      coupon_code: r.coupon_id ? couponMap.get(r.coupon_id) ?? null : null,
      discount_amount: Number(r.discount_amount ?? 0),
      created_at: r.created_at,
      refund_request_status:
        (r as { refund_request_status?: string | null }).refund_request_status ?? null,
      refund_request_reason:
        (r as { refund_request_reason?: string | null }).refund_request_reason ?? null,
    };
  });

  const pages: PageOption[] = (pagesRaw ?? []).map((p) => ({ id: p.id, title: p.title }));

  // ── Monthly earnings series for the chart (last 12 months) ───────────
  const paid = rows.filter((r) => r.status === "paid");
  const byMonth = new Map<string, number>();
  for (const r of paid) {
    const k = String(r.created_at).slice(0, 7); // yyyy-MM
    byMonth.set(k, (byMonth.get(k) ?? 0) + r.amount);
  }
  const earnings: EarningsPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = format(d, "yyyy-MM");
    earnings.push({
      key,
      // Show the year on January so the axis reads across year boundaries.
      label: d.getMonth() === 0 ? format(d, "MMM yy") : format(d, "MMM"),
      value: byMonth.get(key) ?? 0,
    });
  }

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Transactions"
        blurb="Every order ever placed on your pages."
        gradient="from-indigo-600 via-blue-600 to-cyan-600"
      >
        <ExportCsvButton type="orders" className={HERO_BTN} />
      </DashboardHero>

      <EarningsCard series={earnings} />

      <TransactionsClient
        rows={rows}
        pages={pages}
        initialFilter={{ from: "", to: "", status: "", page_id: "", search: "" }}
        isAdmin={!!profile?.is_admin}
        canRefund
      />
    </div>
  );
}
