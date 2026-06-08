import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Hash } from "lucide-react";

import {
  DiscordMembersClient,
  type DiscordMember,
} from "@/components/dashboard/discord/DiscordMembersClient";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Discord server" };

export default async function DiscordServerPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: server } = await admin
    .from("discord_servers")
    .select("id, user_id, guild_name, guild_id, access_duration_days, auto_renewal_enabled")
    .eq("id", params.id)
    .maybeSingle();
  if (!server || server.user_id !== user.id) notFound();

  const { data: memsRaw } = await admin
    .from("discord_memberships")
    .select(
      "id, buyer_email, status, discord_user_id, invite_link, invited_at, joined_at, expires_at",
    )
    .eq("discord_server_id", server.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const members = ((memsRaw ?? []) as Array<{
    id: string;
    buyer_email: string | null;
    status: string;
    discord_user_id: string | null;
    invite_link: string | null;
    invited_at: string | null;
    joined_at: string | null;
    expires_at: string | null;
  }>).map<DiscordMember>((m) => ({
    id: m.id,
    email: m.buyer_email ?? "—",
    status: m.status,
    discordUserId: m.discord_user_id,
    inviteLink: m.invite_link,
    invitedAt: m.invited_at,
    joinedAt: m.joined_at,
    expiresAt: m.expires_at,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/discord">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#5865F2]/10 p-2.5">
          <Hash className="h-5 w-5 text-[#5865F2]" />
        </div>
        <div>
          <h1 className="font-sora text-xl font-semibold">
            {server.guild_name ?? "Discord server"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {server.access_duration_days > 0
              ? `${server.access_duration_days}-day access`
              : "Lifetime access"}
            {server.auto_renewal_enabled ? " · renewal reminders on" : ""}
          </p>
        </div>
      </div>

      <DiscordMembersClient serverId={server.id} members={members} />
    </div>
  );
}
