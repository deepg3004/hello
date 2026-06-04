// /dashboard/settings/team — Team & Roles (Session 15). Owner-only: invite
// teammates by email and assign a preset role. Members act on this account
// (effective-owner resolution in lib/account-context) gated by lib/rbac.

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  TeamManager,
  type TeamRow,
} from "@/components/dashboard/team/TeamManager";
import type { Role } from "@/lib/rbac";

export const metadata = { title: "Team & Roles" };

export default async function TeamPage() {
  const ctx = await requirePageActor("team.view", "/dashboard/settings/team");

  const admin = createAdminClient();
  const { data } = await admin
    .from("team_members")
    .select("id, email, role, status, member_user_id, invited_at")
    .eq("owner_id", ctx.ownerId)
    .neq("status", "revoked")
    .order("invited_at", { ascending: false });

  const members: TeamRow[] = (data ?? []).map((m) => ({
    id: m.id as string,
    email: m.email as string,
    role: m.role as Exclude<Role, "owner">,
    status: m.status as "invited" | "active",
    invitedAt: m.invited_at as string,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Team & Roles"
        blurb="Invite teammates to help run your store. Each role sees and does only what it should — billing, gateway and team stay with you."
        gradient="from-violet-600 via-purple-600 to-fuchsia-600"
        resourcesHref={null}
      />
      <TeamManager members={members} />
    </div>
  );
}
