"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";
import {
  resolveSurfaceConfig,
  resolveChromeConfig,
  SURFACES,
  type Surface,
  type SurfaceConfig,
  type ChromeConfig,
} from "@/lib/storefront-theme";

interface Result {
  ok: boolean;
  message?: string;
}

/** Save the design config for one surface (store | course). Merges into the
 *  seller's storefront_config so the other surface is untouched. */
export async function saveStorefrontDesignAction(
  surface: Surface,
  config: SurfaceConfig,
): Promise<Result> {
  const ctx = await getActorContext();
  if (!ctx || !(ctx.can("store.manage") || ctx.can("courses.manage"))) {
    return { ok: false, message: "Not allowed" };
  }
  if (!SURFACES.some((s) => s.key === surface)) {
    return { ok: false, message: "Bad surface" };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("user_profiles")
    .select("storefront_config")
    .eq("id", ctx.ownerId)
    .maybeSingle();

  // Re-resolve through the defaults so we only persist known, valid fields.
  const clean = resolveSurfaceConfig({ [surface]: config }, surface);
  const existing = (row?.storefront_config ?? {}) as Record<string, unknown>;
  const next = { ...existing, [surface]: clean };

  const { error } = await admin
    .from("user_profiles")
    .update({ storefront_config: next })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/storefront-design");
  return { ok: true };
}

/** Save the shared header/footer/menu (chrome) for the whole storefront. */
export async function saveStorefrontChromeAction(chrome: ChromeConfig): Promise<Result> {
  const ctx = await getActorContext();
  if (!ctx || !(ctx.can("store.manage") || ctx.can("courses.manage"))) {
    return { ok: false, message: "Not allowed" };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("user_profiles")
    .select("storefront_config")
    .eq("id", ctx.ownerId)
    .maybeSingle();

  const clean = resolveChromeConfig({ chrome });
  const existing = (row?.storefront_config ?? {}) as Record<string, unknown>;
  const next = { ...existing, chrome: clean };

  const { error } = await admin
    .from("user_profiles")
    .update({ storefront_config: next })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/storefront-design");
  return { ok: true };
}
