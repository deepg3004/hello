"use server";

// Buyer self-service: wishlist + saved address book. Every action is gated by
// a verified buyer-portal session (the signed BUYER_COOKIE → email); all rows
// are scoped to that email. Tolerant of a not-yet-applied migration 085 —
// missing-table errors degrade to a friendly { ok:false } instead of throwing.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: boolean; message?: string };

function buyerEmail(): string | null {
  try {
    const raw = cookies().get(BUYER_COOKIE)?.value;
    if (!raw) return null;
    return verifyBuyerSession(raw);
  } catch {
    return null;
  }
}

const NOT_SIGNED_IN = "Sign in at /account to use this.";

export async function addToWishlistAction(pageId: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  if (!pageId) return { ok: false, message: "Missing item." };

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, title")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return { ok: false, message: "Item not found." };

  const { error } = await admin
    .from("buyer_wishlist")
    .upsert(
      {
        buyer_email: email.toLowerCase(),
        page_id: page.id,
        seller_user_id: page.user_id,
        title: page.title,
      },
      { onConflict: "buyer_email,page_id" },
    );
  if (error) return { ok: false, message: "Couldn't save. Try again." };
  revalidatePath("/account");
  return { ok: true };
}

export async function removeFromWishlistAction(id: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  const admin = createAdminClient();
  const { error } = await admin
    .from("buyer_wishlist")
    .delete()
    .eq("id", id)
    .eq("buyer_email", email.toLowerCase());
  if (error) return { ok: false, message: "Couldn't remove." };
  revalidatePath("/account");
  return { ok: true };
}

export interface AddressInput {
  id?: string;
  full_name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
  country?: string;
  is_default?: boolean;
}

export async function saveAddressAction(input: AddressInput): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };

  const full_name = input.full_name?.trim();
  const line1 = input.line1?.trim();
  const city = input.city?.trim();
  const pincode = input.pincode?.trim();
  if (!full_name || !line1 || !city || !pincode) {
    return { ok: false, message: "Name, address, city and PIN are required." };
  }

  const admin = createAdminClient();
  const lower = email.toLowerCase();
  const row = {
    buyer_email: lower,
    full_name,
    phone: input.phone?.trim() || null,
    line1,
    line2: input.line2?.trim() || null,
    city,
    state: input.state?.trim() || null,
    pincode,
    country: input.country?.trim() || "India",
    is_default: !!input.is_default,
    updated_at: new Date().toISOString(),
  };

  let savedId = input.id;
  if (input.id) {
    const { error } = await admin
      .from("buyer_addresses")
      .update(row)
      .eq("id", input.id)
      .eq("buyer_email", lower);
    if (error) return { ok: false, message: "Couldn't save address." };
  } else {
    const { data, error } = await admin
      .from("buyer_addresses")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, message: "Couldn't save address." };
    savedId = data?.id;
  }

  // Only one default per buyer.
  if (row.is_default && savedId) {
    await admin
      .from("buyer_addresses")
      .update({ is_default: false })
      .eq("buyer_email", lower)
      .neq("id", savedId);
  }

  revalidatePath("/account");
  return { ok: true };
}

export async function deleteAddressAction(id: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  const admin = createAdminClient();
  const { error } = await admin
    .from("buyer_addresses")
    .delete()
    .eq("id", id)
    .eq("buyer_email", email.toLowerCase());
  if (error) return { ok: false, message: "Couldn't delete." };
  revalidatePath("/account");
  return { ok: true };
}

export async function setDefaultAddressAction(id: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  const admin = createAdminClient();
  const lower = email.toLowerCase();
  const { error } = await admin
    .from("buyer_addresses")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("buyer_email", lower);
  if (error) return { ok: false, message: "Couldn't update." };
  await admin
    .from("buyer_addresses")
    .update({ is_default: false })
    .eq("buyer_email", lower)
    .neq("id", id);
  revalidatePath("/account");
  return { ok: true };
}
