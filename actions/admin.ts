"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog, requireAdmin } from "@/lib/admin/audit";
import { encryptValue, decryptValue, vaultConfigured } from "@/lib/admin/vault";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey } from "@/lib/plans";
import { notifyKyc } from "@/lib/notifications/events";
import {
  sendViaSmtp,
  MAILBOX_ROLES,
  type MailboxRole,
} from "@/lib/emails/smtp";

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

  await notifyKyc({ userId: sub.user_id, kind: "approved" }, admin);

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
  const { data: sub } = await admin
    .from("kyc_submissions")
    .select("user_id")
    .eq("id", submissionId)
    .single();

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

  if (sub?.user_id) {
    await notifyKyc(
      { userId: sub.user_id, kind: "rejected", reason: reason.trim() },
      admin,
    );
  }

  revalidatePath("/admin/kyc");
  return { ok: true };
}

/**
 * Force a seller to re-verify. The status CHECK only allows
 * pending/approved/rejected/under_review, so we close out the current
 * submission as rejected (with a "Re-KYC requested" reason) and reset the
 * profile's verification flags + level so the KYC wizard reopens for a fresh
 * submission. Payouts are disabled until they re-verify.
 */
export async function requestReKycAction(
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
  const { data: sub } = await admin
    .from("kyc_submissions")
    .select("user_id")
    .eq("id", submissionId)
    .single();
  if (!sub) return { ok: false, message: "Submission not found" };

  const now = new Date().toISOString();
  await admin
    .from("kyc_submissions")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewer_id: adminId,
      rejection_reason: `Re-KYC requested: ${reason.trim()}`,
    })
    .eq("id", submissionId);

  await admin
    .from("user_profiles")
    .update({
      kyc_level: 0,
      payouts_enabled: false,
      bank_verified: false,
      pan_verified: false,
    })
    .eq("id", sub.user_id);

  await writeAuditLog({
    admin_id: adminId,
    action: "kyc.rekyc_requested",
    target_type: "kyc_submission",
    target_id: submissionId,
    details: { reason, user_id: sub.user_id },
  });

  await notifyKyc(
    { userId: sub.user_id, kind: "rekyc", reason: reason.trim() },
    admin,
  );

  revalidatePath("/admin/kyc");
  return { ok: true };
}

/**
 * Manual KYC override — verify (or revoke) a seller directly, WITHOUT requiring
 * a clean automated submission. For sellers verified offline, stuck in the
 * automated PAN/bank flow, or who need their verification pulled.
 *
 * verify  → kyc_level 2, pan/bank verified, payouts enabled; the latest open
 *           submission (if any) is marked approved so the queue stays in sync.
 * revoke  → resets all verification flags + disables payouts.
 */
export async function manualVerifyKycAction(
  userId: string,
  opts: { revoke?: boolean; note?: string } = {},
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!userId) return { ok: false, message: "Missing user" };

  const admin = createAdminClient();
  const verify = !opts.revoke;
  const now = new Date().toISOString();
  const note = opts.note?.trim() || null;

  const { error: profileErr } = await admin
    .from("user_profiles")
    .update({
      kyc_level: verify ? 2 : 0,
      pan_verified: verify,
      bank_verified: verify,
      payouts_enabled: verify,
    })
    .eq("id", userId);
  if (profileErr) return { ok: false, message: profileErr.message };

  // Keep the KYC queue consistent: reflect the override on the most recent
  // submission, if one exists.
  const { data: latest } = await admin
    .from("kyc_submissions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id) {
    await admin
      .from("kyc_submissions")
      .update({
        status: verify ? "approved" : "rejected",
        reviewed_at: now,
        reviewer_id: adminId,
        rejection_reason: verify
          ? null
          : `Verification revoked by admin${note ? `: ${note}` : ""}`,
      })
      .eq("id", latest.id);
  }

  await writeAuditLog({
    admin_id: adminId,
    action: verify ? "kyc.manual_verified" : "kyc.manual_revoked",
    target_type: "user",
    target_id: userId,
    details: { note },
  });

  if (verify) {
    await notifyKyc({ userId, kind: "approved" }, admin);
  }

  revalidatePath(`/admin/users/${userId}`);
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

/**
 * Send a test email through a mailbox role's Gmail SMTP config, to the admin's
 * own address. No Resend fallback — the point is to prove the Gmail credentials
 * actually work, so SMTP errors (bad app password, 2FA off) surface verbatim.
 */
export async function sendTestEmailAction(
  role: MailboxRole,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  if (!MAILBOX_ROLES.includes(role)) {
    return { ok: false, message: "Unknown mailbox" };
  }

  const admin = createAdminClient();
  const { data: userRes, error: userErr } =
    await admin.auth.admin.getUserById(adminId);
  const to = userRes?.user?.email;
  if (userErr || !to) {
    return { ok: false, message: "Couldn't resolve your admin email" };
  }

  const res = await sendViaSmtp({
    role,
    to,
    subject: `InvoxAI SMTP test — ${role} mailbox`,
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
      <h2 style="margin:0 0 12px;font-size:18px">SMTP test successful ✅</h2>
      <p style="margin:0 0 12px">This is a test email from the <strong>${role}</strong> mailbox. If you can read it, the Gmail address and app password are working.</p>
      <p style="margin:0;color:#71717a;font-size:12px">Sent from Admin → Email.</p>
    </div>`,
    text: `SMTP test successful. This is a test email from the ${role} mailbox.`,
  });

  await writeAuditLog({
    admin_id: adminId,
    action: "email.test_sent",
    target_type: "platform_setting",
    target_id: `smtp_${role}`,
    details: { ok: res.ok, skipped: res.skipped ?? false },
  });

  if (res.skipped) {
    return {
      ok: false,
      message: "This mailbox isn't configured — set a Gmail address and app password first.",
    };
  }
  if (!res.ok) {
    return { ok: false, message: res.message ?? "SMTP send failed" };
  }
  return { ok: true, message: `Test email sent to ${to}` };
}
