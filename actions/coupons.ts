"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

export interface CouponInput {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  total_limit: number | null;
  per_customer_limit: number;
  starts_at: string | null;
  expires_at: string | null;
  page_ids: string[];
  active: boolean;
  /** When true, the code is publicly listed at checkout for buyers to tap. */
  show_at_checkout: boolean;
}

export interface CouponActionResult {
  ok: boolean;
  message?: string;
  coupon_id?: string;
}

const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function validate(input: CouponInput): string | null {
  const code = normalizeCode(input.code);
  if (!CODE_RE.test(code)) {
    return "Code must be 3–32 chars: A–Z, 0–9, dash or underscore.";
  }
  if (!["percentage", "fixed"].includes(input.discount_type)) {
    return "Invalid discount type.";
  }
  if (!Number.isFinite(input.discount_value) || input.discount_value <= 0) {
    return "Discount value must be positive.";
  }
  if (input.discount_type === "percentage" && input.discount_value > 100) {
    return "Percentage can't exceed 100.";
  }
  if (input.per_customer_limit < 1) {
    return "Per-customer limit must be at least 1.";
  }
  if (
    input.total_limit !== null &&
    (input.total_limit < 1 || !Number.isInteger(input.total_limit))
  ) {
    return "Total limit must be a positive whole number or empty.";
  }
  if (input.starts_at && input.expires_at && input.starts_at >= input.expires_at) {
    return "End date must be after start date.";
  }
  return null;
}

// Returns the effective account-owner id when the actor may manage coupons,
// else null (not signed in OR lacking the coupons.manage permission).
async function requireSeller() {
  const actor = await requireActor("coupons.manage");
  return actor.ok ? actor.ctx.ownerId : null;
}

export async function generateCouponCodeAction(): Promise<{ code: string }> {
  return { code: nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, "X") };
}

export async function createCouponAction(
  input: CouponInput,
): Promise<CouponActionResult> {
  const userId = await requireSeller();
  if (!userId) return { ok: false, message: "Not signed in" };

  const err = validate(input);
  if (err) return { ok: false, message: err };

  const admin = createAdminClient();
  const code = normalizeCode(input.code);

  const { data: clash } = await admin
    .from("coupons")
    .select("id")
    .eq("user_id", userId)
    .eq("code", code)
    .maybeSingle();
  if (clash) return { ok: false, message: "You already have a coupon with this code." };

  const { data, error } = await admin
    .from("coupons")
    .insert({
      user_id: userId,
      code,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order: input.min_order,
      max_discount: input.max_discount,
      total_limit: input.total_limit,
      per_customer_limit: input.per_customer_limit,
      starts_at: input.starts_at,
      expires_at: input.expires_at,
      page_ids: input.page_ids,
      active: input.active,
      show_at_checkout: input.show_at_checkout,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Insert failed" };
  }

  revalidatePath("/dashboard/coupons");
  return { ok: true, coupon_id: data.id };
}

export async function updateCouponAction(
  id: string,
  input: CouponInput,
): Promise<CouponActionResult> {
  const userId = await requireSeller();
  if (!userId) return { ok: false, message: "Not signed in" };

  const err = validate(input);
  if (err) return { ok: false, message: err };

  const admin = createAdminClient();
  const code = normalizeCode(input.code);

  // Check ownership.
  const { data: existing } = await admin
    .from("coupons")
    .select("id, user_id, code")
    .eq("id", id)
    .single();
  if (!existing || existing.user_id !== userId) {
    return { ok: false, message: "Not allowed" };
  }

  if (existing.code !== code) {
    const { data: clash } = await admin
      .from("coupons")
      .select("id")
      .eq("user_id", userId)
      .eq("code", code)
      .neq("id", id)
      .maybeSingle();
    if (clash) return { ok: false, message: "Another coupon already uses this code." };
  }

  const { error } = await admin
    .from("coupons")
    .update({
      code,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order: input.min_order,
      max_discount: input.max_discount,
      total_limit: input.total_limit,
      per_customer_limit: input.per_customer_limit,
      starts_at: input.starts_at,
      expires_at: input.expires_at,
      page_ids: input.page_ids,
      active: input.active,
      show_at_checkout: input.show_at_checkout,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/coupons");
  return { ok: true, coupon_id: id };
}

export async function toggleCouponActiveAction(
  id: string,
): Promise<CouponActionResult> {
  const userId = await requireSeller();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("coupons")
    .select("id, user_id, active")
    .eq("id", id)
    .single();
  if (!c || c.user_id !== userId) return { ok: false, message: "Not allowed" };
  await admin.from("coupons").update({ active: !c.active }).eq("id", id);
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

export async function duplicateCouponAction(id: string): Promise<CouponActionResult> {
  const userId = await requireSeller();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("coupons")
    .select("*")
    .eq("id", id)
    .single();
  if (!c || c.user_id !== userId) return { ok: false, message: "Not allowed" };

  const newCode = `${(c.code as string).slice(0, 24)}_${nanoid(4).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
  const { data: inserted, error } = await admin
    .from("coupons")
    .insert({
      user_id: userId,
      code: newCode,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order: c.min_order,
      max_discount: c.max_discount,
      total_limit: c.total_limit,
      per_customer_limit: c.per_customer_limit,
      starts_at: c.starts_at,
      expires_at: c.expires_at,
      page_ids: c.page_ids,
      active: false, // duplicates default to inactive
      show_at_checkout: c.show_at_checkout ?? false,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Duplicate failed" };
  }
  revalidatePath("/dashboard/coupons");
  return { ok: true, coupon_id: inserted.id };
}

export async function deleteCouponAction(id: string): Promise<CouponActionResult> {
  const userId = await requireSeller();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("coupons")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (!c || c.user_id !== userId) return { ok: false, message: "Not allowed" };
  const { error } = await admin.from("coupons").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}
