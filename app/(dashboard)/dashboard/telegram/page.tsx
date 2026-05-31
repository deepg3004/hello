import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight, Plus, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Telegram" };

export default async function TelegramListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: groupsRaw } = await admin
    .from("telegram_vip_groups")
    .select(
      "id, group_name, group_id, bot_username, access_duration_days, auto_renewal_enabled, webhook_set_at, active_members, page_id, pages(title, slug)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const groups = (groupsRaw ?? []) as unknown as Array<{
    id: string;
    group_name: string | null;
    group_id: string;
    bot_username: string | null;
    access_duration_days: number | null;
    auto_renewal_enabled: boolean | null;
    webhook_set_at: string | null;
    active_members: number | null;
    page_id: string | null;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-sora font-semibold tracking-tight">Telegram VIP groups</h1>
          <p className="text-sm text-muted-foreground">
            Buyers get a one-time invite on payment and are auto-removed on expiry.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/telegram/setup">
            <Plus className="mr-2 h-4 w-4" />
            New setup
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <Send className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-2 text-lg font-semibold">No Telegram groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a bot + group so paid buyers join automatically.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/telegram/setup">
              <Plus className="mr-2 h-4 w-4" /> Set up Telegram VIP
            </Link>
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Bot</TableHead>
                  <TableHead>Linked page</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const page = Array.isArray(g.pages) ? g.pages[0] : g.pages;
                  return (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/telegram/${g.id}`}
                          className="font-medium hover:underline"
                        >
                          {g.group_name ?? g.group_id}
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono">{g.group_id}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {g.bot_username ? `@${g.bot_username}` : "—"}
                      </TableCell>
                      <TableCell>
                        {page ? (
                          <Link href={`/p/${page.slug}`} target="_blank" className="hover:underline">
                            {page.title}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {g.access_duration_days === 0 || g.access_duration_days == null
                          ? "Lifetime"
                          : `${g.access_duration_days} days`}
                        {g.auto_renewal_enabled && (
                          <Badge variant="outline" className="ml-2 text-xs">Renewals on</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(g.active_members ?? 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        {g.webhook_set_at ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Live</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800">Not set</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/telegram/${g.id}`}
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          aria-label="Manage group"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
