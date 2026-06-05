"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Search, UserPlus } from "lucide-react";

import {
  addMemberAction,
  sellerRevokeMembershipAction,
  sellerSetJoinedAction,
} from "@/actions/discord";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export interface DiscordMember {
  id: string;
  email: string;
  status: string;
  discordUserId: string | null;
  inviteLink: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  expiresAt: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  invited: "secondary",
  expired: "outline",
  removed: "destructive",
  banned: "destructive",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DiscordMembersClient({
  serverId,
  members,
}: {
  serverId: string;
  members: DiscordMember[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Add-member form
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => m.email.toLowerCase().includes(t));
  }, [members, q]);

  function add() {
    start(async () => {
      const r = await addMemberAction({
        serverId,
        email,
        durationDays: days ? parseInt(days, 10) : null,
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Couldn't add member", description: r.message });
        return;
      }
      toast({ title: "Invite created", description: "Share the link with the buyer." });
      setEmail("");
      setDays("");
      router.refresh();
    });
  }

  function setJoined(id: string) {
    const uid = window.prompt(
      "Optional: paste the member's Discord user ID so they can be auto-removed on expiry. Leave blank to just mark joined.",
    );
    if (uid === null) return; // cancelled
    start(async () => {
      const r = await sellerSetJoinedAction(id, true, uid.trim() || undefined);
      if (!r.ok) toast({ variant: "destructive", title: "Failed", description: r.message });
      router.refresh();
    });
  }

  function revoke(id: string) {
    if (!window.confirm("Remove this member's access?")) return;
    start(async () => {
      const r = await sellerRevokeMembershipAction(id);
      if (!r.ok) toast({ variant: "destructive", title: "Failed", description: r.message });
      router.refresh();
    });
  }

  function copy(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(link);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-4">
      {/* Add member */}
      <Card>
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              Buyer email
            </label>
            <Input
              type="email"
              placeholder="buyer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="mb-1 block text-xs text-muted-foreground">
              Days (blank = lifetime)
            </label>
            <Input
              type="number"
              min={0}
              placeholder="30"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <Button onClick={add} disabled={pending || !email.trim()}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Add
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Members */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No members yet. Buyers appear here automatically after they pay.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[m.status] ?? "secondary"} className="capitalize">
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(m.joinedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.expiresAt ? fmt(m.expiresAt) : "Lifetime"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {m.inviteLink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copy(m.inviteLink!)}
                            title="Copy invite link"
                          >
                            {copied === m.inviteLink ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {m.status === "invited" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setJoined(m.id)}
                            disabled={pending}
                          >
                            Mark joined
                          </Button>
                        )}
                        {(m.status === "active" || m.status === "invited") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => revoke(m.id)}
                            disabled={pending}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
