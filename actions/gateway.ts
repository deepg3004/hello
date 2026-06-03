"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptGatewayKey } from "@/lib/gateway-crypto";
import type { GatewayType } from "@/lib/gateway-loader";

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

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
      seller_user_id: user.id,
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
