"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical } from "lucide-react";

import { extendMembershipAction, revokeMembershipAction } from "@/actions/telegram";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const EXTEND_OPTIONS = [7, 14, 30, 90];

export function TelegramMembershipActions({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function extend(days: number) {
    setBusy(true);
    const r = await extendMembershipAction(membershipId, days);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Extend failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: `Extended by ${days} days` });
    router.refresh();
  }

  async function revoke() {
    if (!confirm("Kick the buyer out of the group?")) return;
    setBusy(true);
    const r = await revokeMembershipAction(membershipId);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Revoke failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Membership revoked" });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {EXTEND_OPTIONS.map((days) => (
          <DropdownMenuItem key={days} onSelect={() => extend(days)}>
            Extend +{days} days
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onSelect={revoke}
          className="text-destructive focus:text-destructive"
        >
          Revoke + kick
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
