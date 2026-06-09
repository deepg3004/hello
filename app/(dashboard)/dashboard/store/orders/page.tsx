// /dashboard/store/orders — fulfillment queue for PHYSICAL orders (Session 10).
// Lists paid orders that have a shipping address and lets the seller move them
// through unfulfilled → packed → shipped → delivered with tracking.

import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  FulfillmentRow,
  type FulfillmentOrder,
} from "@/components/dashboard/store/FulfillmentRow";

export const metadata = { title: "Store orders" };

interface Addr {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state_code?: string | null;
  pincode?: string | null;
}

function addressLines(a: Addr | null): string[] {
  if (!a) return [];
  const out: string[] = [];
  if (a.line1) out.push(a.line1);
  if (a.line2) out.push(a.line2);
  const cityLine = [a.city, a.state_code, a.pincode].filter(Boolean).join(", ");
  if (cityLine) out.push(cityLine);
  return out;
}

export default async function StoreOrdersPage() {
  const ctx = await requirePageActor("store.view", "/dashboard/store/orders");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, amount, shipping_fee, shipping_address, fulfillment_status, tracking_number, tracking_url, created_at, products!orders_product_id_fkey(name)",
    )
    .eq("seller_user_id", ctx.ownerId)
    .in("status", ["paid", "partially_refunded"])
    .not("shipping_address", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const orders: FulfillmentOrder[] = (rows ?? []).map((o) => {
    const product = Array.isArray(o.products) ? o.products[0] : o.products;
    return {
      id: o.id,
      buyer_name: o.buyer_name,
      buyer_email: o.buyer_email,
      product_name: (product as { name: string } | null)?.name ?? null,
      amount: Number(o.amount ?? 0),
      shipping_fee: Number(o.shipping_fee ?? 0),
      address_lines: addressLines(o.shipping_address as Addr | null),
      fulfillment_status: (o.fulfillment_status ??
        "unfulfilled") as FulfillmentOrder["fulfillment_status"],
      tracking_number: o.tracking_number,
      tracking_url: o.tracking_url,
      created_at: o.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Store orders"
        blurb="Fulfil your physical orders — mark them packed, shipped or delivered and add tracking."
        gradient="from-emerald-600 via-teal-600 to-cyan-600"
      />

      {orders.length === 0 ? (
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">
          No physical orders to fulfil yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <FulfillmentRow key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
