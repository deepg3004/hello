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
  /** Cashfree only: use the sandbox API base instead of production. */
  is_sandbox?: boolean;
}

/**
 * Returns the decrypted gateway keys for a seller, or null when no active
 * gateway is configured / the stored blob can't be decrypted.
 */
export async function loadSellerGatewayKeys(
  sellerUserId: string,
): Promise<GatewayKeys | null> {
  const admin = createAdminClient();
  // A seller may have several gateways connected; checkout uses the ONE marked
  // active. limit(1)+maybeSingle keeps this safe even if data ever drifts to
  // zero/two active rows.
  const { data } = await admin
    .from("seller_gateway_config")
    .select(
      "gateway_type, key_id_enc, key_secret_enc, webhook_secret_enc, is_active, is_sandbox",
    )
    .eq("seller_user_id", sellerUserId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  try {
    return {
      gateway_type: data.gateway_type as GatewayType,
      key_id: decryptGatewayKey(data.key_id_enc),
      key_secret: decryptGatewayKey(data.key_secret_enc),
      webhook_secret: data.webhook_secret_enc
        ? decryptGatewayKey(data.webhook_secret_enc)
        : undefined,
      is_sandbox: !!(data as { is_sandbox?: boolean }).is_sandbox,
    };
  } catch (e) {
    console.error("[gateway-loader] decryption failed for seller", sellerUserId, e);
    return null;
  }
}
