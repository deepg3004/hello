"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  inviteTeamMemberAction,
  changeTeamRoleAction,
  revokeTeamMemberAction,
} from "@/actions/team";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type Role,
} from "@/lib/rbac";

type Assignable = Exclude<Role, "owner">;

export interface TeamRow {
  id: string;
  email: string;
  role: Assignable;
  status: "invited" | "active";
  invitedAt: string;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm";

export function TeamManager({ members }: { members: TeamRow[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Assignable>("staff");

  function invite() {
    start(async () => {
      const res = await inviteTeamMemberAction({ email, role });
      if (res.ok) {
        setEmail("");
        toast({ title: "Invite sent", description: `We emailed ${email}.` });
      } else {
        toast({ variant: "destructive", title: "Couldn't invite", description: res.message });
      }
    });
  }

  function changeRole(id: string, next: Assignable) {
    start(async () => {
      const res = await changeTeamRoleAction({ id, role: next });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't update role", description: res.message });
      }
    });
  }

  function revoke(id: string, who: string) {
    if (!confirm(`Remove ${who} from your team?`)) return;
    start(async () => {
      const res = await revokeTeamMemberAction(id);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't remove", description: res.message });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Invite */}
      <div className="card-surface space-y-4 p-5">
        <h2 className="font-sora text-sm font-semibold">Invite a teammate</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="mt-1"
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Assignable)}
              className={`mt-1 block w-full ${SELECT_CLASS}`}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={invite} disabled={pending || !email.trim()}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send invite
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {ROLE_DESCRIPTIONS[role]}
        </p>
      </div>

      {/* Members */}
      <div className="card-surface p-5">
        <h2 className="mb-3 font-sora text-sm font-semibold">
          Team members ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teammates yet. Invite someone above.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.status === "invited" ? "Invite pending" : "Active"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as Assignable)}
                    disabled={pending}
                    className={SELECT_CLASS}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => revoke(m.id, m.email)}
                    disabled={pending}
                    aria-label="Remove"
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
