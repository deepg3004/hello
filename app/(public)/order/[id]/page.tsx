import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

interface OrderRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  buyer_email: string;
  buyer_name: string | null;
  paid_at: string | null;
  product_id: string | null;
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, amount, currency, status, buyer_email, buyer_name, paid_at, product_id")
    .eq("id", params.id)
    .single<OrderRow>();

  if (!order) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          invoxai.io / order
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-4 text-muted-foreground">
          We couldn&apos;t find that order. If you just paid, give it a few
          seconds and refresh.
        </p>
      </main>
    );
  }

  // Lazy product lookup just for the name on the receipt.
  let productName = "Your purchase";
  if (order.product_id) {
    const { data: product } = await admin
      .from("products")
      .select("name")
      .eq("id", order.product_id)
      .single<{ name: string }>();
    if (product?.name) productName = product.name;
  }

  const paid = order.status === "paid";

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>{paid ? "Payment successful" : "Order received"}</CardTitle>
          <CardDescription>
            {paid
              ? `Thanks${order.buyer_name ? `, ${order.buyer_name}` : ""}. We've emailed your receipt to ${order.buyer_email}.`
              : "We've recorded your order. Confirmation will arrive once payment is captured."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Item</span>
              <span className="font-medium">{productName}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-medium">
                ₹{Number(order.amount).toLocaleString("en-IN")} {order.currency}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Order id</span>
              <span className="font-mono text-xs">{order.id.slice(0, 12)}…</span>
            </div>
          </div>

          <Button asChild className="w-full">
            <Link href="/">Done</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
