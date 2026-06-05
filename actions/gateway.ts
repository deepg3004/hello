"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/account-context";
import { encryptGatewayKey } from "@/lib/gateway-crypto";
import type { GatewayType, GatewayKeys } from "@/lib/gateway-loader";
import { getGateway } from "@/lib/gateways";

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
}): Promise<Result> {
  const actor = await requireActor("gateway.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const gateway_type = input.gateway_type as GatewayType;
  if (!GATEWAY_TYPES.includes(gateway_type)) {
    return { ok: false, message: "Unsupported gateway" };
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
  const { error } = await admin.from("seller_gateway_config").upsert(
    {
      seller_user_id: ctx.ownerId,
      gateway_type,
      key_id_enc,
      key_secret_enc,
      webhook_secret_enc,
      is_active: true,
      // Re-saving keys means they must be proven again with a test payment.
      is_verified: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seller_user_id" },
  );

  if (error) {
    console.error("[saveGatewayConfigAction] upsert failed", error);
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings/gateway");
  return { ok: true };
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
}): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const gateway_type = input.gateway_type as GatewayType;
  if (!GATEWAY_TYPES.includes(gateway_type)) {
    return { ok: false, message: "Unsupported gateway" };
  }
  const keys: GatewayKeys = {
    gateway_type,
    key_id: input.key_id?.trim() ?? "",
    key_secret: input.key_secret?.trim() ?? "",
    webhook_secret: input.webhook_secret?.trim() || undefined,
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
  await admin
    .from("seller_gateway_config")
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq("seller_user_id", user.id)
    .eq("gateway_type", gateway_type);

  revalidatePath("/dashboard/settings/gateway");
  return { ok: true, message: "Connection verified." };
}
