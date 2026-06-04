"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/account-context";
import { type PlanKey } from "@/lib/plans";

export interface StartUpgradeInput {
  plan: PlanKey;
}

export interface StartUpgradeResult {
  ok: boolean;
  redirectUrl?: string;
  message?: string;
}

/**
 * Thin wrapper around the /api/subscriptions/create endpoint, called from the
 * pricing page. Lives here so the page itself stays a server component.
 */
export async function startUpgradeAction(
  input: StartUpgradeInput,
): Promise<StartUpgradeResult> {
  // Billing is owner-only (billing.manage ⇒ acting on one's own account).
  const actor = await requireActor("billing.manage");
  if (!actor.ok) return { ok: false, message: actor.error };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  // Defer to the API route so signature/webhook code stays in one place.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/subscriptions/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan: input.plan, user_id: user.id, email: user.email }),
    cache: "no-store",
  });

  const json = (await res.json()) as { redirect_url?: string; error?: string };
  if (!res.ok || !json.redirect_url) {
    return { ok: false, message: json.error ?? "Couldn't start subscription" };
  }
  return { ok: true, redirectUrl: json.redirect_url };
}
