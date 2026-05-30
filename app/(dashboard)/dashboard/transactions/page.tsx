import { redirect } from "next/navigation";

import {
  TransactionsClient,
  type PageOption,
  type TransactionRow,
} from "@/components/dashboard/TransactionsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: rowsRaw }, { data: pagesRaw }, { data: profile }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, buyer_name, buyer_email, buyer_phone, buyer_address, amount, platform_commission, seller_amount, status, payment_gateway, gateway_payment_id, utm_source, utm_medium, utm_campaign, created_at, pages(title, slug)",
      )
      .eq("seller_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("pages")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single(),
  ]);

  const rows: TransactionRow[] = ((rowsRaw ?? []) as unknown as Array<{
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
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    created_at: string;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>).map((r) => {
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
      created_at: r.created_at,
    };
  });

  const pages: PageOption[] = (pagesRaw ?? []).map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Every order ever placed on your pages.
        </p>
      </div>
      <TransactionsClient
        rows={rows}
        pages={pages}
        initialFilter={{ from: "", to: "", status: "", page_id: "", search: "" }}
        isAdmin={!!profile?.is_admin}
      />
    </div>
  );
}
