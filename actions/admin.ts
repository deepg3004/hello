"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog, requireAdmin } from "@/lib/admin/audit";
import { encryptValue, decryptValue, vaultConfigured } from "@/lib/admin/vault";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey } from "@/lib/plans";

export interface AdminResult {
  ok: boolean;
  message?: string;
  value?: string;
}

// ============================================================================
// User actions
// ============================================================================

export async function changeUserPlanAction(
  userId: string,
  plan: PlanKey,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!(plan in PLANS)) return { ok: false, message: "Unknown plan" };

  const admin = createAdminClient();
  await admin
    .from("user_profiles")
    .update({
      subscription_plan: plan,
      subscription_status: plan === "free" ? "inactive" : "active",
    })
    .eq("id", userId);

  await writeAuditLog({
    admin_id: adminId,
    action: "user.plan_changed",
    target_type: "user_profile",
    target_id: userId,
    details: { plan },
  });

  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function suspendUserAction(
  userId: string,
  reason: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const admin = createAdminClient();
  await admin
    .from("user_profiles")
    .update({
      suspended_at: new Date().toISOString(),
      suspended_reason: reason,
      suspended_by_admin_id: adminId,
    })
    .eq("id", userId);

  // Also pause any published pages by this user.
  await admin
    .from("pages")
    .update({ status: "paused" })
    .eq("user_id", userId)
    .eq("status", "published");

  await writeAuditLog({
    admin_id: adminId,
    action: "user.suspended",
    target_type: "user_profile",
    target_id: userId,
    details: { reason },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function restoreUserAction(userId: string): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const admin = createAdminClient();
  await admin
    .from("user_profiles")
    .update({
      suspended_at: null,
      suspended_reason: null,
      suspended_by_admin_id: null,
    })
    .eq("id", userId);

  await writeAuditLog({
    admin_id: adminId,
    action: "user.restored",
    target_type: "user_profile",
    target_id: userId,
  });

  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function addAdminNoteAction(
  targetUserId: string,
  body: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  if (!body.trim()) return { ok: false, message: "Note body required" };

  const admin = createAdminClient();
  await admin.from("admin_notes").insert({
    target_user_id: targetUserId,
    admin_id: adminId,
    body: body.trim(),
  });

  await writeAuditLog({
    admin_id: adminId,
    action: "user.note_added",
    target_type: "user_profile",
    target_id: targetUserId,
  });

  revalidatePath(`/admin/users/${targetUserId}`);
  return { ok: true };
}

export async function sendPasswordResetLinkAction(
  userEmail: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: userEmail,
  });
  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    admin_id: adminId,
    action: "user.password_reset_link_generated",
    target_type: "email",
    details: { email: userEmail },
  });

  return { ok: true, value: data?.properties?.action_link ?? undefined };
}

// ============================================================================
// KYC actions
// ============================================================================

export async function approveKycAction(
  submissionId: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("kyc_submissions")
    .select("user_id, level")
    .eq("id", submissionId)
    .single();
  if (!sub) return { ok: false, message: "Submission not found" };

  const now = new Date().toISOString();
  await admin
    .from("kyc_submissions")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewer_id: adminId,
      rejection_reason: null,
    })
    .eq("id", submissionId);

  await admin
    .from("user_profiles")
    .update({
      kyc_level: sub.level ?? 2,
      payouts_enabled: true,
      bank_verified: true,
      pan_verified: true,
    })
    .eq("id", sub.user_id);

  await writeAuditLog({
    admin_id: adminId,
    action: "kyc.approved",
    target_type: "kyc_submission",
    target_id: submissionId,
    details: { user_id: sub.user_id },
  });

  revalidatePath("/admin/kyc");
  return { ok: true };
}

export async function rejectKycAction(
  submissionId: string,
  reason: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!reason.trim()) return { ok: false, message: "Reason required" };

  const admin = createAdminClient();
  await admin
    .from("kyc_submissions")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewer_id: adminId,
      rejection_reason: reason.trim(),
    })
    .eq("id", submissionId);

  await writeAuditLog({
    admin_id: adminId,
    action: "kyc.rejected",
    target_type: "kyc_submission",
    target_id: submissionId,
    details: { reason },
  });

  revalidatePath("/admin/kyc");
  return { ok: true };
}

// ============================================================================
// Page actions
// ============================================================================

export async function flagPageAction(
  pageId: string,
  reason: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin
    .from("pages")
    .update({
      flagged_at: new Date().toISOString(),
      flag_reason: reason || null,
      flagged_by_admin_id: adminId,
    })
    .eq("id", pageId);

  await writeAuditLog({
    admin_id: adminId,
    action: "page.flagged",
    target_type: "page",
    target_id: pageId,
    details: { reason },
  });

  revalidatePath("/admin/pages");
  return { ok: true };
}

export async function unflagPageAction(pageId: string): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin
    .from("pages")
    .update({ flagged_at: null, flag_reason: null, flagged_by_admin_id: null })
    .eq("id", pageId);

  await writeAuditLog({
    admin_id: adminId,
    action: "page.unflagged",
    target_type: "page",
    target_id: pageId,
  });

  revalidatePath("/admin/pages");
  return { ok: true };
}

export async function suspendPageAction(pageId: string): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin.from("pages").update({ status: "paused" }).eq("id", pageId);

  await writeAuditLog({
    admin_id: adminId,
    action: "page.suspended",
    target_type: "page",
    target_id: pageId,
  });

  revalidatePath("/admin/pages");
  return { ok: true };
}

export async function restorePageAction(pageId: string): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin
    .from("pages")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", pageId);

  await writeAuditLog({
    admin_id: adminId,
    action: "page.restored",
    target_type: "page",
    target_id: pageId,
  });

  revalidatePath("/admin/pages");
  return { ok: true };
}

// ============================================================================
// Order actions
// ============================================================================

export async function adminRefundOrderAction(
  orderId: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", orderId);

  await writeAuditLog({
    admin_id: adminId,
    action: "order.refunded",
    target_type: "order",
    target_id: orderId,
  });

  revalidatePath("/admin/transactions");
  return { ok: true };
}

export async function adminMarkOrderPaidAction(
  orderId: string,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId);

  await writeAuditLog({
    admin_id: adminId,
    action: "order.marked_paid",
    target_type: "order",
    target_id: orderId,
  });

  revalidatePath("/admin/transactions");
  return { ok: true };
}

// ============================================================================
// Platform settings + credentials
// ============================================================================

export async function updateSettingAction(
  key: string,
  value: string,
  encrypted = false,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  if (encrypted && !vaultConfigured()) {
    return { ok: false, message: "Set INVOXAI_VAULT_KEY before storing secrets" };
  }

  const stored = encrypted ? encryptValue(value) : value;
  const admin = createAdminClient();
  await admin
    .from("platform_settings")
    .upsert(
      {
        key,
        value: stored,
        encrypted,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      },
      { onConflict: "key" },
    );

  await writeAuditLog({
    admin_id: adminId,
    action: "setting.updated",
    target_type: "platform_setting",
    target_id: key,
    details: { encrypted },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/credentials");
  return { ok: true };
}

export async function revealCredentialAction(key: string): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value, encrypted")
    .eq("key", key)
    .single();
  if (!data) return { ok: false, message: "Not set" };

  let plaintext = data.value;
  if (data.encrypted) {
    if (!vaultConfigured()) return { ok: false, message: "Vault key missing" };
    try {
      plaintext = decryptValue(data.value);
    } catch {
      return { ok: false, message: "Decryption failed" };
    }
  }

  await writeAuditLog({
    admin_id: adminId,
    action: "credential.revealed",
    target_type: "platform_setting",
    target_id: key,
  });

  return { ok: true, value: plaintext };
}
