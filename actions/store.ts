"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

interface Result {
  ok: boolean;
  message?: string;
}

/**
 * Set the physical-product attributes (shipping requirement + inventory) on the
 * product attached to one of the seller's pages. Stock null = untracked.
 */
export async function updateProductPhysicalAction(input: {
  page_id: string;
  requires_shipping: boolean;
  stock: number | null;
  sku?: string | null;
}): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  // Verify the seller owns this page (and thus its product).
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id")
    .eq("id", input.page_id)
    .maybeSingle();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Page not found" };
  }

  const stock =
    input.stock === null || input.stock === undefined
      ? null
      : Math.max(0, Math.floor(Number(input.stock)));

  const { error } = await admin
    .from("products")
    .update({
      requires_shipping: !!input.requires_shipping,
      stock,
      sku: input.sku?.trim() || null,
    })
    .eq("page_id", input.page_id)
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/pages/${input.page_id}/edit`);
  return { ok: true };
}

/** Seller-level shipping config (flat fee + free-shipping threshold). */
export async function updateShippingConfigAction(input: {
  shipping_flat_fee: number;
  free_shipping_over: number | null;
}): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      shipping_flat_fee: Math.max(0, Number(input.shipping_flat_fee) || 0),
      free_shipping_over:
        input.free_shipping_over && input.free_shipping_over > 0
          ? Number(input.free_shipping_over)
          : null,
    })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Update fulfillment status + tracking on one of the seller's orders. */
export async function updateFulfillmentAction(input: {
  order_id: string;
  fulfillment_status: "unfulfilled" | "packed" | "shipped" | "delivered";
  tracking_number?: string | null;
  tracking_url?: string | null;
}): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    fulfillment_status: input.fulfillment_status,
    tracking_number: input.tracking_number?.trim() || null,
    tracking_url: input.tracking_url?.trim() || null,
  };
  if (input.fulfillment_status === "shipped") {
    patch.shipped_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("orders")
    .update(patch)
    .eq("id", input.order_id)
    .eq("seller_user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store/orders");
  return { ok: true };
}
