import { Download } from "lucide-react";

import {
  AdminTransactionsClient,
  type AdminTxnRow,
} from "@/components/admin/AdminTransactionsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Transactions" };

const rupees = (n: number) => formatINR(n * 100);

export default async function AdminTransactionsPage() {
  const admin = createAdminClient();
  const { data: rowsRaw } = await admin
    .from("orders")
    .select(
      "id, buyer_email, amount, platform_commission, status, payment_gateway, gateway_payment_id, created_at, paid_at, seller_user_id, user_profiles!orders_seller_user_id_fkey(full_name, email), pages(title)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const raw = (rowsRaw ?? []) as unknown as Array<{
    id: string;
    buyer_email: string;
    amount: number;
    platform_commission: number;
    status: string;
    payment_gateway: string | null;
    created_at: string;
    seller_user_id: string;
    user_profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
    pages: { title: string } | { title: string }[] | null;
  }>;

  const rows: AdminTxnRow[] = raw.map((r) => {
    const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
    const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    return {
      id: r.id,
      buyer_email: r.buyer_email,
      amount: Number(r.amount ?? 0),
      commission: Number(r.platform_commission ?? 0),
      status: r.status,
      payment_gateway: r.payment_gateway,
      created_at: r.created_at,
      seller_user_id: r.seller_user_id,
      seller_name: seller?.full_name ?? seller?.email ?? "—",
      page_title: page?.title ?? null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "paid") {
        acc.gmv += r.amount;
        acc.commission += r.commission;
      }
      return acc;
    },
    { gmv: 0, commission: 0 },
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Transactions"
        blurb="All orders platform-wide. Refunds (full or partial) log to admin audit."
        resourcesHref={null}
      >
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm text-foreground">
            <div>
              GMV <span className="ml-2 font-mono">{rupees(totals.gmv)}</span>
            </div>
            <div className="text-muted-foreground">
              Commission{" "}
              <span className="ml-2 font-mono">{rupees(totals.commission)}</span>
            </div>
          </div>
          <a
            href="/api/admin/export/transactions"
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Export all (CSV)
          </a>
        </div>
      </DashboardHero>

      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminTransactionsClient rows={rows} />
      </div>
    </div>
  );
}
