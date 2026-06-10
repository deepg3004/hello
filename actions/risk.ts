"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog, requireAdmin } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addBlocklistEntry,
  removeBlocklistEntry,
  type BlocklistKind,
} from "@/lib/risk/blocklist";

export interface RiskResult {
  ok: boolean;
  message?: string;
}

const KINDS: BlocklistKind[] = ["email", "ip", "phone"];

export async function addBlocklistAction(
  kind: BlocklistKind,
  value: string,
  reason: string,
): Promise<RiskResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!KINDS.includes(kind)) return { ok: false, message: "Invalid kind" };
  if (!value.trim()) return { ok: false, message: "Value is required" };

  const res = await addBlocklistEntry({
    kind,
    value,
    reason: reason.trim() || null,
    createdBy: adminId,
  });
  if (!res.ok) return res;

  await writeAuditLog({
    admin_id: adminId,
    action: "risk.blocklist_added",
    target_type: "risk_blocklist",
    details: { kind, value: value.trim(), reason: reason.trim() || null },
  });
  revalidatePath("/admin/risk");
  return { ok: true };
}

export async function removeBlocklistAction(id: string): Promise<RiskResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const res = await removeBlocklistEntry(id);
  if (!res.ok) return res;

  await writeAuditLog({
    admin_id: adminId,
    action: "risk.blocklist_removed",
    target_type: "risk_blocklist",
    target_id: id,
  });
  revalidatePath("/admin/risk");
  return { ok: true };
}

const THRESHOLD_KEYS = [
  "risk_velocity_email_per_hour",
  "risk_velocity_ip_per_hour",
  "risk_high_value_inr",
  "risk_duplicate_window_min",
  "risk_flag_threshold",
] as const;

export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];

/** Persist the risk-scoring thresholds to platform_settings. */
export async function updateRiskThresholdsAction(
  values: Record<ThresholdKey, number>,
): Promise<RiskResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  for (const key of THRESHOLD_KEYS) {
    const n = Number(values[key]);
    if (!Number.isFinite(n) || n < 0) continue;
    await admin
      .from("platform_settings")
      .upsert(
        { key, value: String(Math.round(n)), encrypted: false, updated_by: adminId },
        { onConflict: "key" },
      );
  }
  await writeAuditLog({
    admin_id: adminId,
    action: "risk.thresholds_updated",
    target_type: "platform_settings",
    details: values,
  });
  revalidatePath("/admin/risk");
  return { ok: true };
}

/** Mark a flagged order as reviewed/cleared (keeps the score for the record). */
export async function clearOrderFlagAction(orderId: string): Promise<RiskResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ review_status: "cleared" })
    .eq("id", orderId);
  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    admin_id: adminId,
    action: "risk.order_cleared",
    target_type: "order",
    target_id: orderId,
  });
  revalidatePath("/admin/risk");
  return { ok: true };
}

/**
 * One-click: block the email or IP from a flagged order and mark it cleared.
 * `kind` selects which identifier to block.
 */
export async function blockFromOrderAction(
  orderId: string,
  kind: "email" | "ip",
): Promise<RiskResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("buyer_email, ip_address")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, message: "Order not found" };

  const value = kind === "email" ? order.buyer_email : order.ip_address;
  if (!value) return { ok: false, message: `Order has no ${kind}` };

  const res = await addBlocklistEntry({
    kind,
    value: String(value),
    reason: `Blocked from flagged order ${orderId}`,
    createdBy: adminId,
  });
  if (!res.ok) return res;

  await admin
    .from("orders")
    .update({ review_status: "cleared" })
    .eq("id", orderId);

  await writeAuditLog({
    admin_id: adminId,
    action: "risk.blocked_from_order",
    target_type: "order",
    target_id: orderId,
    details: { kind, value: String(value) },
  });
  revalidatePath("/admin/risk");
  return { ok: true };
}
