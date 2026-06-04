"use server";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { requireActor, ACTING_ACCOUNT_COOKIE } from "@/lib/account-context";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";

interface Result {
  ok: boolean;
  message?: string;
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function appBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
}

// ─── Account switcher ────────────────────────────────────────────────────────

/**
 * Switch which account the dashboard acts on. The user can always switch to
 * their own account; switching to another requires an active membership.
 */
export async function setActingAccountAction(ownerId: string): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  if (ownerId !== user.id) {
    const admin = createAdminClient();
    const { data: m } = await admin
      .from("team_members")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("member_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!m) return { ok: false, message: "You're not a member of that account." };
  }

  cookies().set(ACTING_ACCOUNT_COOKIE, ownerId, COOKIE_OPTS);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─── Owner: manage the team ──────────────────────────────────────────────────

/** Invite a teammate by email with a preset role. Owner-only (team.manage). */
export async function inviteTeamMemberAction(input: {
  email: string;
  role: Role;
}): Promise<Result> {
  const actor = await requireActor("team.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter a valid email." };
  if (!ASSIGNABLE_ROLES.includes(input.role as Exclude<Role, "owner">)) {
    return { ok: false, message: "Pick a valid role." };
  }

  const admin = createAdminClient();

  // Can't invite the owner's own email.
  const { data: ownerProfile } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", ctx.ownerId)
    .single();
  if (ownerProfile?.email?.toLowerCase() === email) {
    return { ok: false, message: "That's the account owner's email." };
  }

  // If the email already has an account, pre-link it so they're active on accept.
  const { data: existingUser } = await admin
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const rawToken = randomBytes(32).toString("base64url");

  const { data: row, error } = await admin
    .from("team_members")
    .upsert(
      {
        owner_id: ctx.ownerId,
        email,
        role: input.role,
        status: "invited",
        invite_token_hash: hashToken(rawToken),
        member_user_id: existingUser?.id ?? null,
        invited_at: new Date().toISOString(),
        accepted_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,email" },
    )
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, message: error?.message ?? "Couldn't create the invite." };
  }

  // Send the invite. Best-effort — the row exists either way.
  const link = `${appBase()}/team/accept?token=${rawToken}&id=${row.id}`;
  const brand = ownerProfile?.email ? `${ownerProfile.email}'s` : "a";
  try {
    await sendEmail({
      to: email,
      role: "noreply",
      subject: `You've been invited to ${brand} InvoxAI team`,
      html: `
        <p>You've been invited to join ${brand} InvoxAI account as <strong>${ROLE_LABELS[input.role]}</strong>.</p>
        <p><a href="${link}">Accept the invite →</a></p>
        <p style="color:#64748b;font-size:13px">If you don't have an InvoxAI account yet, you'll be able to create one with this email. This link is single-use.</p>
      `,
    });
  } catch {
    /* non-fatal */
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

/** Change a member's role. Owner-only. */
export async function changeTeamRoleAction(input: {
  id: string;
  role: Role;
}): Promise<Result> {
  const actor = await requireActor("team.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;
  if (!ASSIGNABLE_ROLES.includes(input.role as Exclude<Role, "owner">)) {
    return { ok: false, message: "Pick a valid role." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ role: input.role, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("owner_id", ctx.ownerId); // scope to this owner — can't touch others' rows
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

/** Revoke a member (or a pending invite). Owner-only. */
export async function revokeTeamMemberAction(id: string): Promise<Result> {
  const actor = await requireActor("team.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

// ─── Invitee: accept ─────────────────────────────────────────────────────────

/**
 * Accept an invite. Requires the signed-in user's email to match the invited
 * email (anti-hijack). Links membership, activates it, and switches the acting
 * account to the new owner.
 */
export async function acceptTeamInviteAction(
  token: string,
  rowId: string,
): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("team_members")
    .select("id, owner_id, email, status, invite_token_hash")
    .eq("id", rowId)
    .maybeSingle();
  if (!row || row.status === "revoked") {
    return { ok: false, message: "This invite is no longer valid." };
  }
  if (!row.invite_token_hash || row.invite_token_hash !== hashToken(token)) {
    return { ok: false, message: "This invite link is invalid." };
  }

  const myEmail = (user.email ?? "").toLowerCase();
  if (myEmail !== row.email.toLowerCase()) {
    return {
      ok: false,
      message: `This invite is for ${row.email}. Sign in with that email to accept.`,
    };
  }
  if (row.owner_id === user.id) {
    return { ok: false, message: "You can't be a member of your own account." };
  }

  const { error } = await admin
    .from("team_members")
    .update({
      member_user_id: user.id,
      status: "active",
      accepted_at: new Date().toISOString(),
      invite_token_hash: null, // single-use
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);
  if (error) return { ok: false, message: error.message };

  // Drop them straight into the account they just joined.
  cookies().set(ACTING_ACCOUNT_COOKIE, row.owner_id, COOKIE_OPTS);
  revalidatePath("/dashboard");
  return { ok: true };
}
