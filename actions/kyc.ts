"use server";

import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  message?: string;
  linked_account_id?: string;
}

/**
 * Thin server-action wrapper around POST /api/kyc/create-linked-account.
 * Kept here so a future dashboard "Enable payouts" button is a one-liner.
 */
export async function createLinkedAccountAction(): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/kyc/create-linked-account`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.id }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    linked_account_id?: string;
    error?: string;
  };
  if (!res.ok || !json.linked_account_id) {
    return { ok: false, message: json.error ?? "Linked account creation failed" };
  }
  return { ok: true, linked_account_id: json.linked_account_id };
}
