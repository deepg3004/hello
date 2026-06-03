"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Check,
  Copy,
  Pencil,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";

export interface ListChannel {
  id: string;
  name: string;
  type: string | null;
  username: string | null;
  logoUrl: string | null;
  activeMembers: number;
  memberCount: number;
  revenue: number; // rupees
  setupComplete: boolean;
  pageUrl: string | null;
  plans: Array<{ name: string; price: number }>;
}

export function TelegramListClient({
  connected,
  username,
  channels,
}: {
  connected: boolean;
  username: string | null;
  channels: ListChannel[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"revenue" | "members" | "name">("revenue");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? channels.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.username?.toLowerCase().includes(q) ?? false),
        )
      : channels;
    const sorted = [...list];
    switch (sort) {
      case "members":
        sorted.sort((a, b) => b.activeMembers - a.activeMembers);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => b.revenue - a.revenue);
    }
    return sorted;
  }, [channels, search, sort]);

  async function disconnect() {
    await fetch("/api/telegram/user/disconnect", { method: "DELETE" });
    router.refresh();
  }

  function copy(url: string) {
    void navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  }

  // STATE A — only when there are NO channels yet. Existing channels/pages
  // stay visible even if the Telegram account is later disconnected.
  if (!connected && channels.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0088cc] text-white">
            <Send className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-sora font-semibold">Monetize your Telegram channels</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Connect your Telegram account to set up paid access, manage
              subscribers, and track revenue.
            </p>
          </div>
          <ul className="space-y-1 text-left text-sm text-muted-foreground">
            <li>✅ Multi-plan subscriptions (1 Month, 3 Month, Lifetime)</li>
            <li>✅ Auto-remove expired members</li>
            <li>✅ Real-time revenue dashboard</li>
            <li>✅ Coupon codes &amp; free trials</li>
          </ul>
          <Button asChild size="lg">
            <Link href="/dashboard/telegram/setup">Connect Telegram →</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STATE B — connected
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {connected ? (
          <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-sm">
            <Send className="h-4 w-4 text-[#0088cc]" />
            <span className="font-medium">{username ? `@${username}` : "Telegram"} connected</span>
            <button onClick={disconnect} className="ml-1 text-xs text-muted-foreground hover:underline">
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <Send className="h-4 w-4" />
            <span className="font-medium">Telegram not connected</span>
            <Link href="/dashboard/telegram/setup" className="ml-1 text-xs underline">Reconnect</Link>
          </div>
        )}
        <Button asChild>
          <Link href="/dashboard/telegram/setup">
            <Plus className="mr-2 h-4 w-4" /> Add channel
          </Link>
        </Button>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No channels set up yet.{" "}
            <Link href="/dashboard/telegram/setup" className="text-foreground underline">
              Set one up
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <>
          {channels.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search channels"
                  className="pl-9"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Top revenue</SelectItem>
                  <SelectItem value="members">Most members</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-sm font-semibold text-white">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.username ? `@${c.username} · ` : ""}
                      {c.type ?? "channel"}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={c.setupComplete ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}
                  >
                    {c.setupComplete ? "Live" : "Draft"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y py-3 text-center">
                  <div>
                    <div className="text-lg font-semibold">{c.activeMembers.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground">Active members</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{formatINR(c.revenue * 100)}</div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                  </div>
                </div>

                {c.plans.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.plans.slice(0, 4).map((p, i) => (
                      <span key={i} className="rounded-full border px-2 py-0.5 text-xs">
                        {p.name} {formatINR(p.price * 100)}
                      </span>
                    ))}
                  </div>
                )}

                {c.pageUrl && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md border bg-muted/40 px-2 py-1 text-xs">{c.pageUrl}</code>
                    <Button variant="outline" size="sm" onClick={() => copy(c.pageUrl!)}>
                      {copied === c.pageUrl ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/telegram/${c.id}`}><BarChart3 className="mr-1 h-4 w-4" /> Dashboard</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/telegram/${c.id}/plans`}><Pencil className="mr-1 h-4 w-4" /> Edit plans</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/telegram/${c.id}?tab=members`}><Users className="mr-1 h-4 w-4" /> Members</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
