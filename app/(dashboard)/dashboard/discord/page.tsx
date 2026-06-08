import Link from "next/link";
import { redirect } from "next/navigation";
import { Hash, Plus, Users } from "lucide-react";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { IntegrationTabs } from "@/components/dashboard/integrations/IntegrationTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Discord" };

export default async function DiscordListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: serversRaw } = await admin
    .from("discord_servers")
    .select("id, guild_name, guild_id, active_members, page_id, setup_complete")
    .eq("user_id", user.id)
    .eq("setup_complete", true)
    .order("created_at", { ascending: false });

  const servers = (serversRaw ?? []) as Array<{
    id: string;
    guild_name: string | null;
    guild_id: string;
    active_members: number | null;
    page_id: string | null;
    setup_complete: boolean | null;
  }>;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Group Integrations"
        blurb="Sell paid access to your Discord server. Buyers get a one-time invite the moment they pay, and access expires automatically on your schedule."
      >
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard/discord/setup">
            <Plus className="mr-1.5 h-4 w-4" />
            Connect a server
          </Link>
        </Button>
      </DashboardHero>

      <IntegrationTabs />

      {servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="rounded-full bg-muted p-3">
              <Hash className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Discord servers connected yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Connect your bot and server to start selling paid access. Buyers
                are invited automatically after checkout.
              </p>
            </div>
            <Button asChild className="mt-1">
              <Link href="/dashboard/discord/setup">
                <Plus className="mr-1.5 h-4 w-4" />
                Connect a server
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {servers.map((s) => (
            <Link key={s.id} href={`/dashboard/discord/${s.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-lg bg-[#5865F2]/10 p-2.5">
                    <Hash className="h-5 w-5 text-[#5865F2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.guild_name ?? "Discord server"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Users className="mr-1 inline h-3 w-3" />
                      {s.active_members ?? 0} active member
                      {(s.active_members ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
