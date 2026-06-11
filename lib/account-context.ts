// Team & Roles / RBAC (Session 15) — resolves WHICH seller account the current
// request acts on, and WHAT the actor may do.
//
// A signed-in user is always the owner of their OWN account. If they've been
// invited to other accounts (active team_members rows) they can switch into one
// via the `invoxai_acting_account` cookie. getActorContext() validates the
// cookie against real membership and returns the effective owner id + role.
//
// USAGE in server actions / pages:
//   const ctx = await getActorContext();
//   if (!ctx) return { ok: false, message: "Not signed in" };
//   if (!ctx.can("pages.manage")) return { ok: false, message: DENIED_MESSAGE };
//   // scope BUSINESS resources to ctx.ownerId; keep IDENTITY ops on ctx.authUserId

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Role, type Capability, can, DENIED_MESSAGE } from "@/lib/rbac";

export const ACTING_ACCOUNT_COOKIE = "invoxai_acting_account";

export interface ActorContext {
  /** The logged-in Supabase user — use for IDENTITY ops (profile, password, 2FA). */
  authUserId: string;
  /** The account being acted upon — use for ALL business-resource scoping. */
  ownerId: string;
  role: Role;
  /** True only when acting on one's own account as the owner. */
  isOwner: boolean;
  can: (capability: Capability) => boolean;
}

function build(authUserId: string, ownerId: string, role: Role): ActorContext {
  return {
    authUserId,
    ownerId,
    role,
    isOwner: role === "owner" && authUserId === ownerId,
    can: (capability) => can(role, capability),
  };
}

/**
 * Resolve the actor context for the current request. Returns null when not
 * signed in. Falls back to the user's OWN account (owner role) when the
 * acting-account cookie is missing or doesn't map to an active membership.
 *
 * Wrapped in React cache() so it runs ONCE per server render: a single
 * /dashboard render previously called this ~8 times (layout + each page's
 * requirePageActor + nested components), each firing supabase.auth.getUser()
 * which can trigger a token refresh. At access-token expiry those concurrent
 * per-render refreshes raced to rotate the same token -> refresh_token_already_used
 * bursts that exhausted the GoTrue rate limit. cache() collapses them to one.
 */
export const getActorContext = cache(async function getActorContext(): Promise<ActorContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let acting: string | undefined;
  try {
    acting = cookies().get(ACTING_ACCOUNT_COOKIE)?.value;
  } catch {
    acting = undefined;
  }
  if (!acting || acting === user.id) {
    return build(user.id, user.id, "owner");
  }

  // Acting on another account — must be an active member of it.
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("team_members")
    .select("role, status")
    .eq("owner_id", acting)
    .eq("member_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return build(user.id, user.id, "owner");
  return build(user.id, acting, membership.role as Role);
});

/**
 * Guard for server actions. Resolves the actor and (optionally) checks a
 * capability in one call:
 *
 *   const { ctx, error } = await requireActor("pages.manage");
 *   if (error) return { ok: false, message: error };
 *   // ...use ctx.ownerId
 */
export async function requireActor(
  capability?: Capability,
): Promise<{ ok: true; ctx: ActorContext } | { ok: false; error: string }> {
  const ctx = await getActorContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  if (capability && !ctx.can(capability)) {
    return { ok: false, error: DENIED_MESSAGE };
  }
  return { ok: true, ctx };
}

/**
 * Server-component guard: resolve the actor, redirect to login when signed out,
 * and to /dashboard when the role lacks `capability`. Returns the context (use
 * ctx.ownerId to scope reads).
 */
export async function requirePageActor(
  capability: Capability,
  next: string,
): Promise<ActorContext> {
  const ctx = await getActorContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!ctx.can(capability)) redirect("/dashboard");
  return ctx;
}

export interface ActingAccount {
  ownerId: string;
  label: string;
  role: Role;
  isOwn: boolean;
}

/**
 * Every account the user can act on: their own (Owner) plus any active
 * memberships. Drives the Topbar account switcher.
 */
export async function listActingAccounts(
  authUserId: string,
  authEmail: string | null,
): Promise<ActingAccount[]> {
  const admin = createAdminClient();

  const own: ActingAccount = {
    ownerId: authUserId,
    label: authEmail ? `My account (${authEmail})` : "My account",
    role: "owner",
    isOwn: true,
  };

  const { data: memberships } = await admin
    .from("team_members")
    .select("owner_id, role, owner:owner_id(full_name, email)")
    .eq("member_user_id", authUserId)
    .eq("status", "active");

  const others: ActingAccount[] = (memberships ?? []).map((m) => {
    const ownerRel = (m as { owner: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null }).owner;
    const owner = Array.isArray(ownerRel) ? ownerRel[0] : ownerRel;
    return {
      ownerId: m.owner_id as string,
      label: owner?.full_name || owner?.email || "Account",
      role: m.role as Role,
      isOwn: false,
    };
  });

  return [own, ...others];
}
