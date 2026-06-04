"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

// Tiny curated pool so the seed events look believable. Cities span India
// metros + tier-2 so a buyer reading "Riya S. from Indore" doesn't smell
// fake on day one.
const SEED_NAMES = [
  "Riya S.",
  "Aarav P.",
  "Ananya G.",
  "Vihaan M.",
  "Ishita K.",
  "Kabir J.",
  "Meera N.",
  "Aditya R.",
  "Saanvi T.",
  "Rohan D.",
  "Tanvi B.",
  "Aryan V.",
  "Diya C.",
  "Madhav L.",
];
const SEED_CITIES = [
  "Mumbai",
  "Bengaluru",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Jaipur",
  "Ahmedabad",
  "Kolkata",
  "Indore",
  "Lucknow",
  "Surat",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

interface SeedInput {
  page_id: string;
  count: number;
}

export interface SeedResult {
  ok: boolean;
  inserted: number;
  message?: string;
}

/**
 * Insert 1-10 seed (is_seed=true) social-proof events for a page owned by
 * the signed-in seller. Spaced 5 minutes apart in the past so they don't
 * look like a single batch insert when rendered with "just now".
 */
export async function seedSocialProofAction(
  input: SeedInput,
): Promise<SeedResult> {
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, inserted: 0, message: actor.error };
  const { ctx } = actor;

  const count = Math.max(1, Math.min(10, Math.round(Number(input.count))));
  if (!input.page_id) {
    return { ok: false, inserted: 0, message: "page_id required" };
  }

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, title")
    .eq("id", input.page_id)
    .single();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, inserted: 0, message: "Not your page" };
  }

  // Use the page's first active product (if any) for the product_name.
  const { data: products } = await admin
    .from("products")
    .select("name, price")
    .eq("page_id", page.id)
    .eq("active", true)
    .limit(1);
  const product = products?.[0];

  const now = Date.now();
  const rows = Array.from({ length: count }, (_, i) => {
    // Spread the seeds across the last 6 hours, randomly within each slot
    // so they don't have identical minute marks.
    const ago = i * 30 * 60 * 1000 + Math.floor(Math.random() * 15 * 60 * 1000);
    const price = product?.price
      ? Number(product.price)
      : Math.floor(Math.random() * 4_000) + 499;
    return {
      page_id: page.id,
      buyer_name: pick(SEED_NAMES),
      buyer_city: pick(SEED_CITIES),
      product_name: product?.name ?? page.title,
      amount: price,
      is_seed: true,
      created_at: new Date(now - ago).toISOString(),
    };
  });

  const { error, data } = await admin
    .from("social_proof_events")
    .insert(rows)
    .select("id");
  if (error) {
    return { ok: false, inserted: 0, message: error.message };
  }

  revalidatePath(`/dashboard/pages/${page.id}/edit`);
  return { ok: true, inserted: data?.length ?? rows.length };
}
