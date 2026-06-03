// =============================================================================
// Loads a seller's own (decrypted) gateway keys for checkout.
//
// Used by the create-order route (Phase 4) to create orders on the seller's
// gateway instead of the platform's. Server-only — reads via the service-role
// admin client and decrypts with lib/gateway-crypto.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptGatewayKey } from "@/lib/gateway-crypto";

export type GatewayType =
  | "razorpay"
  | "cashfree"
  | "payu"
  | "instamojo"
  | "stripe";

export interface GatewayKeys {
  gateway_type: GatewayType;
  key_id: string;
  key_secret: string;
  webhook_secret?: string;
}

/**
 * Returns the decrypted gateway keys for a seller, or null when no active
 * gateway is configured / the stored blob can't be decrypted.
 */
export async function loadSellerGatewayKeys(
  sellerUserId: string,
): Promise<GatewayKeys | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("seller_gateway_config")
    .select(
      "gateway_type, key_id_enc, key_secret_enc, webhook_secret_enc, is_active",
    )
    .eq("seller_user_id", sellerUserId)
    .eq("is_active", true)
    .single();

  if (!data) return null;

  try {
    return {
      gateway_type: data.gateway_type as GatewayType,
      key_id: decryptGatewayKey(data.key_id_enc),
      key_secret: decryptGatewayKey(data.key_secret_enc),
      webhook_secret: data.webhook_secret_enc
        ? decryptGatewayKey(data.webhook_secret_enc)
        : undefined,
    };
  } catch (e) {
    console.error("[gateway-loader] decryption failed for seller", sellerUserId, e);
    return null;
  }
}
