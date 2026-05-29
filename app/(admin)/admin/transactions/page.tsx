import Link from "next/link";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { OrderActionsMenu } from "@/components/admin/OrderActionsMenu";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const rows = (rowsRaw ?? []) as unknown as Array<{
    id: string;
    buyer_email: string;
    amount: number;
    platform_commission: number;
    status: string;
    payment_gateway: string | null;
    gateway_payment_id: string | null;
    created_at: string;
    paid_at: string | null;
    seller_user_id: string;
    user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
    pages: { title: string } | { title: string }[] | null;
  }>;

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "paid") {
        acc.gmv += Number(r.amount ?? 0);
        acc.commission += Number(r.platform_commission ?? 0);
      }
      return acc;
    },
    { gmv: 0, commission: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            All orders platform-wide. Refund or mark-as-paid actions log to admin audit.
          </p>
        </div>
        <div className="text-right text-sm">
          <div>
            GMV <span className="ml-2 font-mono">{rupees(totals.gmv)}</span>
          </div>
          <div className="text-muted-foreground">
            Commission <span className="ml-2 font-mono">{rupees(totals.commission)}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
                  const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.buyer_email}</TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${r.seller_user_id}`} className="hover:underline">
                          {seller?.full_name ?? seller?.email ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{page?.title ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{rupees(Number(r.amount ?? 0))}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {rupees(Number(r.platform_commission ?? 0))}
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {r.payment_gateway ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <OrderActionsMenu orderId={r.id} status={r.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
