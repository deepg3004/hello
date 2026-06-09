"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog, requireAdmin } from "@/lib/admin/audit";
import { encryptValue, decryptValue, vaultConfigured } from "@/lib/admin/vault";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey } from "@/lib/plans";
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

// KYC actions removed (Session 3): no KYC — sellers are gated on
// "own gateway connected AND wallet funded", not on identity verification.

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

/**
 * Admin refund. Delegates to the REAL refund path in actions/transactions.ts so
 * it actually returns the money through the order's own gateway AND reverses the
 * ledger (seller sale + commission), the platform wallet fee, inventory, and
 * buyer access. (This used to just flip orders.status='refunded' — money never
 * moved and nothing was reversed.) Supports an optional partial amount.
 */
export async function adminRefundOrderAction(
  orderId: string,
  amountRupees?: number,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { refundOrderAction } = await import("@/actions/transactions");
  const r = await refundOrderAction(orderId, amountRupees);
  if (!r.ok) return { ok: false, message: r.message };

  await writeAuditLog({
    admin_id: adminId,
    action: "order.refunded",
    target_type: "order",
    target_id: orderId,
    details: { refund_id: r.refund_id ?? null, amount: amountRupees ?? null },
  });

  revalidatePath("/admin/transactions");
  return { ok: true, message: r.refund_id ? `Refunded (${r.refund_id})` : "Refunded" };
}

// ============================================================================
// Coupon oversight (platform-wide)
// ============================================================================

/** Enable/disable any seller's coupon (abuse control). Audit-logged. */
export async function adminToggleCouponAction(
  couponId: string,
  active: boolean,
): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("coupons")
    .update({ active })
    .eq("id", couponId);
  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    admin_id: adminId,
    action: active ? "coupon.enabled" : "coupon.disabled",
    target_type: "coupon",
    target_id: couponId,
  });

  revalidatePath("/admin/coupons");
  return { ok: true, message: active ? "Coupon enabled" : "Coupon disabled" };
}

// ============================================================================
// Store fulfillment (platform-wide — admins can fulfill any seller's order)
// ============================================================================

export async function adminUpdateFulfillmentAction(input: {
  order_id: string;
  fulfillment_status: "unfulfilled" | "packed" | "shipped" | "delivered";
  tracking_number?: string | null;
  tracking_url?: string | null;
}): Promise<AdminResult> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    fulfillment_status: input.fulfillment_status,
    tracking_number: input.tracking_number?.trim() || null,
    tracking_url: input.tracking_url?.trim() || null,
  };
  if (input.fulfillment_status === "shipped") {
    patch.shipped_at = new Date().toISOString();
  }
  const { error } = await admin.from("orders").update(patch).eq("id", input.order_id);
  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    admin_id: adminId,
    action: "order.fulfillment_updated",
    target_type: "order",
    target_id: input.order_id,
    details: { status: input.fulfillment_status, tracking: input.tracking_number ?? null },
  });

  revalidatePath("/admin/store");
  return { ok: true, message: `Marked ${input.fulfillment_status}` };
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
