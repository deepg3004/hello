// Helpers for storefront "sales" sections — top-selling products/courses by
// paid-order / enrollment counts. Returns ordered IDs the page maps to its
// already-loaded catalog items (so we don't refetch product data).

import { createAdminClient } from "@/lib/supabase/admin";

/** Ordered product IDs by paid sales (direct orders + cart line items). */
export async function topSellingProductIds(sellerId: string, limit = 8): Promise<string[]> {
  const admin = createAdminClient();
  const counts = new Map<string, number>();

  const { data: direct } = await admin
    .from("orders")
    .select("product_id")
    .eq("seller_user_id", sellerId)
    .eq("status", "paid")
    .not("product_id", "is", null)
    .limit(2000);
  for (const o of (direct ?? []) as Array<{ product_id: string | null }>) {
    if (o.product_id) counts.set(o.product_id, (counts.get(o.product_id) ?? 0) + 1);
  }

  const { data: cart } = await admin
    .from("order_items")
    .select("product_id, quantity, orders!inner(seller_user_id, status)")
    .eq("orders.seller_user_id", sellerId)
    .eq("orders.status", "paid")
    .limit(2000);
  for (const it of (cart ?? []) as Array<{ product_id: string | null; quantity: number | null }>) {
    if (it.product_id) counts.set(it.product_id, (counts.get(it.product_id) ?? 0) + Math.max(1, Number(it.quantity ?? 1)));
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

/** Ordered course IDs by enrollment count. */
export async function topSellingCourseIds(sellerId: string, limit = 6): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_enrollments")
    .select("course_id, courses!inner(seller_user_id)")
    .eq("courses.seller_user_id", sellerId)
    .limit(3000);
  const counts = new Map<string, number>();
  for (const e of (data ?? []) as Array<{ course_id: string }>) {
    if (e.course_id) counts.set(e.course_id, (counts.get(e.course_id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}
