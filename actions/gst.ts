"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import {
  ALLOWED_GST_RATES,
  GSTIN_REGEX,
  isAllowedRate,
  stateCodeFromGstin,
  STATE_CODES,
} from "@/lib/gst";

export interface SaveGstProfileInput {
  legal_business_name: string;
  gstin: string;
  state_code: string;
  default_hsn_sac: string;
  default_gst_rate: number;
  address_line1: string;
  address_line2?: string;
  city: string;
  pincode: string;
}

export interface SaveGstProfileResult {
  ok: boolean;
  message?: string;
}

const STATE_CODE_RE = /^[0-9]{2}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

export async function saveGstProfileAction(
  input: SaveGstProfileInput,
): Promise<SaveGstProfileResult> {
  const actor = await requireActor("billing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const legal = (input.legal_business_name ?? "").trim();
  if (legal.length < 3) {
    return { ok: false, message: "Legal name is required (min 3 chars)." };
  }
  const gstin = (input.gstin ?? "").trim().toUpperCase();
  if (!GSTIN_REGEX.test(gstin)) {
    return { ok: false, message: "GSTIN format is invalid." };
  }
  const stateCode = (input.state_code ?? "").trim();
  if (!STATE_CODE_RE.test(stateCode) || !STATE_CODES[stateCode]) {
    return { ok: false, message: "Pick a valid 2-digit state code." };
  }
  // Cross-check: first 2 chars of the GSTIN must match the state code.
  const gstinState = stateCodeFromGstin(gstin);
  if (gstinState && gstinState !== stateCode) {
    return {
      ok: false,
      message: `GSTIN belongs to state ${gstinState} but you selected ${stateCode}.`,
    };
  }
  const hsn = (input.default_hsn_sac ?? "").trim();
  if (!/^[0-9]{4,8}$/.test(hsn)) {
    return { ok: false, message: "HSN/SAC should be 4-8 digits." };
  }
  if (!isAllowedRate(input.default_gst_rate)) {
    return {
      ok: false,
      message: `GST rate must be one of ${ALLOWED_GST_RATES.join(", ")}.`,
    };
  }
  const line1 = (input.address_line1 ?? "").trim();
  if (line1.length < 5) {
    return { ok: false, message: "Address line 1 is too short." };
  }
  const city = (input.city ?? "").trim();
  if (city.length < 2) {
    return { ok: false, message: "City is required." };
  }
  const pincode = (input.pincode ?? "").trim();
  if (!PINCODE_RE.test(pincode)) {
    return { ok: false, message: "Pincode is invalid." };
  }

  const gstAddress = {
    line1,
    line2: (input.address_line2 ?? "").trim() || null,
    city,
    state_code: stateCode,
    state: STATE_CODES[stateCode],
    pincode,
    country: "India",
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      legal_business_name: legal,
      gstin,
      gst_address: gstAddress,
      state_code: stateCode,
      default_hsn_sac: hsn,
      default_gst_rate: input.default_gst_rate,
      gst_verified_at: new Date().toISOString(),
    })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/tax-billing");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
