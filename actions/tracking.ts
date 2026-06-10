"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

export interface TrackingResult {
  ok: boolean;
  message?: string;
}

export interface SaveTrackingInput {
  meta_pixel_id?: string;
  ga4_id?: string;
  enable_meta_pixel?: boolean;
  enable_ga4?: boolean;
  enable_advanced_matching?: boolean;
}

const META_RE = /^\d{5,20}$/; // Meta pixel IDs are numeric
const GA4_RE = /^G-[A-Z0-9]{4,16}$/i; // GA4 measurement IDs

/**
 * Save the signed-in seller's Meta Pixel + GA4 tracking settings into the
 * existing marketing_integrations row (Phase 15 slice 1). Validates ID formats
 * so a typo can't inject a broken script tag.
 */
export async function saveTrackingSettingsAction(
  input: SaveTrackingInput,
): Promise<TrackingResult> {
  const actor = await requireActor("marketing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const meta = (input.meta_pixel_id ?? "").trim();
  const ga4 = (input.ga4_id ?? "").trim();
  if (meta && !META_RE.test(meta)) {
    return { ok: false, message: "Meta Pixel ID should be numbers only (from Events Manager)." };
  }
  if (ga4 && !GA4_RE.test(ga4)) {
    return { ok: false, message: "GA4 Measurement ID must look like G-XXXXXXXX." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_integrations")
    .upsert(
      {
        user_id: ctx.ownerId,
        meta_pixel_id: meta || null,
        ga4_id: ga4 || null,
        enable_meta_pixel: input.enable_meta_pixel ?? true,
        enable_ga4: input.enable_ga4 ?? true,
        enable_advanced_matching: input.enable_advanced_matching ?? false,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/tracking");
  return { ok: true };
}
