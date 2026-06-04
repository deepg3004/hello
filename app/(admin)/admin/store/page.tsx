// Admin · Store (Session 16) — all products across sellers plus physical orders
// (fulfillment + tracking). Read-only oversight of the physical/digital store.

import {
  AdminStoreClient,
  type AdminStoreProduct,
  type AdminStoreOrder,
} from "@/components/admin/AdminStoreClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Store" };

export default async function AdminStorePage() {
  const admin = createAdminClient();

  const [{ data: prodRaw }, { data: orderRaw }] = await Promise.all([
    admin
      .from("products")
      .select("id, name, price, category, stock, sku, requires_shipping, active, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("orders")
      .select("id, buyer_name, buyer_email, amount, shipping_fee, fulfillment_status, tracking_number, shipped_at, created_at, seller_user_id")
      .not("fulfillment_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const sellerIds = [
    ...new Set([
      ...(prodRaw ?? []).map((p) => p.user_id as string),
      ...(orderRaw ?? []).map((o) => o.seller_user_id as string),
    ].filter(Boolean)),
  ];
  const nameById = new Map<string, string>();
  if (sellerIds.length) {
    const { data: sellers } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", sellerIds);
    for (const s of sellers ?? []) {
      nameById.set(s.id as string, (s.full_name as string) || (s.email as string) || "—");
    }
  }

  const products: AdminStoreProduct[] = (prodRaw ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string) ?? "—",
    sellerId: p.user_id as string,
    sellerName: nameById.get(p.user_id as string) ?? "—",
    price: Number(p.price ?? 0),
    category: (p.category as string) ?? null,
    stock: p.stock === null || p.stock === undefined ? null : Number(p.stock),
    sku: (p.sku as string) ?? null,
    requiresShipping: !!p.requires_shipping,
    active: !!p.active,
  }));

  const orders: AdminStoreOrder[] = (orderRaw ?? []).map((o) => ({
    id: o.id as string,
    buyerName: (o.buyer_name as string) ?? null,
    buyerEmail: (o.buyer_email as string) ?? "",
    sellerId: o.seller_user_id as string,
    sellerName: nameById.get(o.seller_user_id as string) ?? "—",
    amount: Number(o.amount ?? 0),
    shippingFee: Number(o.shipping_fee ?? 0),
    fulfillmentStatus: (o.fulfillment_status as string) ?? "unfulfilled",
    trackingNumber: (o.tracking_number as string) ?? null,
    shippedAt: (o.shipped_at as string) ?? null,
    createdAt: o.created_at as string,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Store"
        blurb="Every product across sellers, plus physical orders awaiting fulfillment."
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminStoreClient products={products} orders={orders} />
      </div>
    </div>
  );
}
