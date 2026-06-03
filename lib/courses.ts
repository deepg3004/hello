// Server-side course helpers shared by the checkout hook + student player.

import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

/**
 * Enroll a buyer in the course linked to the order's product (if any). Called
 * post-payment. Best-effort — never throws into the checkout flow. Idempotent
 * via the unique (course_id, order_id) constraint.
 */
export async function createEnrollmentForOrder(
  order: { id: string; product_id: string | null; buyer_email: string },
  admin: DB,
): Promise<void> {
  try {
    if (!order.product_id || !order.buyer_email) return;
    const { data: course } = await admin
      .from("courses")
      .select("id, status")
      .eq("product_id", order.product_id)
      .maybeSingle();
    if (!course || course.status !== "published") return;

    await admin
      .from("course_enrollments")
      .upsert(
        {
          course_id: course.id,
          order_id: order.id,
          buyer_email: order.buyer_email,
        },
        { onConflict: "course_id,order_id" },
      );
  } catch (e) {
    console.error("[courses] enrollment failed", e);
  }
}

/** The published course linked to a product, or null. */
export async function courseForProduct(
  productId: string | null | undefined,
  admin: DB,
): Promise<{ id: string; title: string } | null> {
  if (!productId) return null;
  const { data } = await admin
    .from("courses")
    .select("id, title, status")
    .eq("product_id", productId)
    .maybeSingle();
  return data && data.status === "published"
    ? { id: data.id, title: data.title }
    : null;
}
