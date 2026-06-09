"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { encryptGatewayKey } from "@/lib/gateway-crypto";
import type { GatewayType, GatewayKeys } from "@/lib/gateway-loader";
import { getGateway, isLiveGateway } from "@/lib/gateways";

const GATEWAY_TYPES: GatewayType[] = [
  "razorpay",
  "cashfree",
  "payu",
  "instamojo",
  "stripe",
];

interface Result {
  ok: boolean;
  message?: string;
}

/**
 * Save (or replace) the seller's own gateway credentials. Keys are encrypted
 * server-side before they ever touch the database. Writes via the service-role
 * admin client because the table has no client RLS policies (credentials must
 * never be readable from the browser).
 */
export async function saveGatewayConfigAction(input: {
  gateway_type: string;
  key_id: string;
  key_secret: string;
  webhook_secret?: string;
  is_sandbox?: boolean;
}): Promise<Result> {
  const actor = await requireActor("gateway.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const gateway_type = input.gateway_type as GatewayType;
  if (!GATEWAY_TYPES.includes(gateway_type)) {
    return { ok: false, message: "Unsupported gateway" };
  }
  // Only gateways whose buyer-facing checkout is wired end-to-end (liveGateways)
  // may be connected — otherwise a seller would save keys for a gateway that
  // 402s at checkout.
  if (!isLiveGateway(gateway_type)) {
    return {
      ok: false,
      message: "This gateway isn't available yet — more are coming soon.",
    };
  }

  const keyId = input.key_id?.trim();
  const keySecret = input.key_secret?.trim();
  if (!keyId || !keySecret) {
    return { ok: false, message: "Key ID and Key Secret are required." };
  }

  let key_id_enc: string;
  let key_secret_enc: string;
  let webhook_secret_enc: string | null = null;
  try {
    key_id_enc = encryptGatewayKey(keyId);
    key_secret_enc = encryptGatewayKey(keySecret);
    const wh = input.webhook_secret?.trim();
    if (wh) webhook_secret_enc = encryptGatewayKey(wh);
  } catch (e) {
    console.error("[saveGatewayConfigAction] encrypt failed", e);
    return {
      ok: false,
      message:
        "Server encryption key isn't configured. Contact support (GATEWAY_ENCRYPTION_KEY).",
    };
  }

  const admin = createAdminClient();

  // Multi-gateway: keep the seller's other gateways; only (re)write this
  // gateway_type's row. Don't disrupt a working live gateway — preserve an
  // existing row's active flag, and auto-activate only when nothing is active
  // yet (so the first gateway "just works"). Switching active is explicit.
  const { data: rows } = await admin
    .from("seller_gateway_config")
    .select("gateway_type, is_active")
    .eq("seller_user_id", ctx.ownerId);
  const existingRow = rows?.find((r) => r.gateway_type === gateway_type);
  const anyActive = (rows ?? []).some((r) => r.is_active);
  const is_active = existingRow ? !!existingRow.is_active : !anyActive;

  const { error } = await admin.from("seller_gateway_config").upsert(
    {
      seller_user_id: ctx.ownerId,
      gateway_type,
      key_id_enc,
      key_secret_enc,
      webhook_secret_enc,
      is_active,
      is_sandbox: !!input.is_sandbox,
      // Re-saving keys means they must be proven again with a test payment.
      is_verified: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seller_user_id,gateway_type" },
  );

  if (error) {
    console.error("[saveGatewayConfigAction] upsert failed", error);
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings/gateway");
  return {
    ok: true,
    message: is_active
      ? undefined
      : "Saved & encrypted. Click “Make active” to take payments through this gateway.",
  };
}

/**
 * Live "test connection" for the keys a seller is entering, BEFORE we trust
 * them. Calls the provider driver's testConnection(). On success, if a config
 * row already exists for this seller+gateway, mark it is_verified=true.
 */
export async function verifyGatewayAction(input: {
  gateway_type: string;
  key_id: string;
  key_secret: string;
  webhook_secret?: string;
  is_sandbox?: boolean;
}): Promise<Result> {
  // Gate on the capability and resolve the EFFECTIVE owner — otherwise a team
  // member would save the encrypted keys to their OWN account (and the
  // capability check was bypassed entirely). Mirrors saveGatewayConfigAction.
  const actor = await requireActor("gateway.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const gateway_type = input.gateway_type as GatewayType;
  if (!GATEWAY_TYPES.includes(gateway_type)) {
    return { ok: false, message: "Unsupported gateway" };
  }
  if (!isLiveGateway(gateway_type)) {
    return {
      ok: false,
      message: "This gateway isn't available yet — more are coming soon.",
    };
  }
  const keys: GatewayKeys = {
    gateway_type,
    key_id: input.key_id?.trim() ?? "",
    key_secret: input.key_secret?.trim() ?? "",
    webhook_secret: input.webhook_secret?.trim() || undefined,
    is_sandbox: !!input.is_sandbox, // test against the chosen environment
  };
  if (!keys.key_id || !keys.key_secret) {
    return { ok: false, message: "Key ID and Key Secret are required." };
  }

  let result;
  try {
    result = await getGateway(gateway_type).testConnection(keys);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Test failed" };
  }
  if (!result.ok) return { ok: false, message: result.message ?? "Connection failed" };

  const admin = createAdminClient();

  // Multi-gateway: store + verify THIS gateway. Activate it only if the seller
  // has no active gateway yet — switching the active one is an explicit action
  // (setActiveGatewayAction), so a test never silently hijacks a live gateway.
  const { data: rows } = await admin
    .from("seller_gateway_config")
    .select("gateway_type, is_active")
    .eq("seller_user_id", ctx.ownerId);
  const existingRow = rows?.find((r) => r.gateway_type === gateway_type);
  const anyActive = (rows ?? []).some((r) => r.is_active);
  const activate = existingRow ? !!existingRow.is_active || !anyActive : !anyActive;

  try {
    await admin.from("seller_gateway_config").upsert(
      {
        seller_user_id: ctx.ownerId,
        gateway_type,
        key_id_enc: encryptGatewayKey(keys.key_id),
        key_secret_enc: encryptGatewayKey(keys.key_secret),
        webhook_secret_enc: keys.webhook_secret
          ? encryptGatewayKey(keys.webhook_secret)
          : null,
        is_active: activate,
        is_sandbox: !!input.is_sandbox,
        is_verified: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "seller_user_id,gateway_type" },
    );
  } catch (e) {
    console.error("[verifyGatewayAction] persist-on-verify failed", e);
    return { ok: false, message: "Couldn't save the verified keys." };
  }

  revalidatePath("/dashboard/settings/gateway");
  return {
    ok: true,
    message: activate
      ? "Connection verified — this gateway is live."
      : "Connection verified & saved. Click “Make active” to switch to it.",
  };
}

/**
 * Instantly switch which connected gateway is active (the one checkout uses).
 * Exactly one active per seller: deactivate the rest, activate the chosen one.
 */
export async function setActiveGatewayAction(input: {
  gateway_type: string;
}): Promise<Result> {
  const actor = await requireActor("gateway.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const gateway_type = input.gateway_type as GatewayType;
  if (!GATEWAY_TYPES.includes(gateway_type)) {
    return { ok: false, message: "Unsupported gateway" };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("seller_gateway_config")
    .select("gateway_type")
    .eq("seller_user_id", ctx.ownerId)
    .eq("gateway_type", gateway_type)
    .maybeSingle();
  if (!row) return { ok: false, message: "Connect that gateway first." };

  const now = new Date().toISOString();
  await admin
    .from("seller_gateway_config")
    .update({ is_active: false, updated_at: now })
    .eq("seller_user_id", ctx.ownerId)
    .neq("gateway_type", gateway_type);
  const { error } = await admin
    .from("seller_gateway_config")
    .update({ is_active: true, updated_at: now })
    .eq("seller_user_id", ctx.ownerId)
    .eq("gateway_type", gateway_type);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/gateway");
  return { ok: true, message: `Now taking payments through ${gateway_type}.` };
}

/** Remove a connected gateway (deletes its stored keys). */
export async function removeGatewayAction(input: {
  gateway_type: string;
}): Promise<Result> {
  const actor = await requireActor("gateway.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const gateway_type = input.gateway_type as GatewayType;
  if (!GATEWAY_TYPES.includes(gateway_type)) {
    return { ok: false, message: "Unsupported gateway" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("seller_gateway_config")
    .delete()
    .eq("seller_user_id", ctx.ownerId)
    .eq("gateway_type", gateway_type);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/gateway");
  return { ok: true, message: "Gateway removed." };
}
