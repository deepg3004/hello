"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog, requireAdmin } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

interface AdminResult {
  ok: boolean;
  message?: string;
}

/** Hard guardrail on a single manual adjustment — ₹10,00,000 in paise. */
const MAX_ADJUST_PAISE = 100_000_000;

/**
 * Admin manual wallet adjustment. `deltaPaise` > 0 credits, < 0 debits.
 * Rejects overdraft (the RPC respects the balance >= 0 check). Logged to the
 * admin audit trail.
 */
export async function adjustSellerWalletAction(input: {
  sellerId: string;
  deltaPaise: number;
  description?: string;
}): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const delta = Math.trunc(Number(input.deltaPaise));
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, message: "Enter a non-zero amount." };
  }
  if (Math.abs(delta) > MAX_ADJUST_PAISE) {
    return { ok: false, message: "Amount exceeds the per-adjustment limit." };
  }
  if (!input.sellerId) return { ok: false, message: "Missing seller." };

  const description =
    input.description?.trim() ||
    `Admin ${delta > 0 ? "credit" : "debit"}`;

  const admin = createAdminClient();
  const { data: ok, error } = await admin.rpc("admin_adjust_wallet_balance", {
    p_seller_id: input.sellerId,
    p_delta_paise: delta,
    p_description: description,
  });
  if (error) {
    console.error("[adjustSellerWalletAction] rpc failed", error);
    return { ok: false, message: error.message };
  }
  if (ok === false) {
    return { ok: false, message: "Insufficient balance for that debit." };
  }

  await writeAuditLog({
    admin_id: adminId,
    action: delta > 0 ? "wallet.credited" : "wallet.debited",
    target_type: "user_profile",
    target_id: input.sellerId,
    details: { delta_paise: delta, description },
  });

  revalidatePath("/admin/seller-wallets");
  revalidatePath(`/admin/users/${input.sellerId}`);
  return { ok: true };
}

/**
 * Admin toggle of a seller's gateway active / verified flags. Never touches the
 * encrypted key columns.
 */
export async function setGatewayStatusAction(input: {
  sellerId: string;
  is_active?: boolean;
  is_verified?: boolean;
}): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (input.is_active === undefined && input.is_verified === undefined) {
    return { ok: false, message: "Nothing to update." };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.is_verified !== undefined) patch.is_verified = input.is_verified;

  const admin = createAdminClient();
  const { error } = await admin
    .from("seller_gateway_config")
    .update(patch)
    .eq("seller_user_id", input.sellerId);
  if (error) {
    console.error("[setGatewayStatusAction] update failed", error);
    return { ok: false, message: error.message };
  }

  await writeAuditLog({
    admin_id: adminId,
    action: "gateway.updated",
    target_type: "user_profile",
    target_id: input.sellerId,
    details: {
      is_active: input.is_active,
      is_verified: input.is_verified,
    },
  });

  revalidatePath("/admin/gateways");
  revalidatePath(`/admin/users/${input.sellerId}`);
  return { ok: true };
}
