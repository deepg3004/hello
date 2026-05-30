"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical } from "lucide-react";

import {
  approvePayoutAction,
  markPayoutCompletedAction,
  rejectPayoutAction,
} from "@/actions/payouts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface PayoutActionsMenuProps {
  payoutId: string;
  status: string;
}

export function PayoutActionsMenu({ payoutId, status }: PayoutActionsMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [utr, setUtr] = useState("");

  async function approve() {
    if (!confirm("Approve and dispatch now?")) return;
    setBusy(true);
    const r = await approvePayoutAction(payoutId);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Approve failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dispatched" });
    router.refresh();
  }

  async function reject() {
    setBusy(true);
    const r = await rejectPayoutAction(payoutId, reason);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Reject failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payout rejected" });
    setRejectOpen(false);
    setReason("");
    router.refresh();
  }

  async function markCompleted() {
    setBusy(true);
    const r = await markPayoutCompletedAction(payoutId, utr);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't mark complete", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked completed" });
    setMarkOpen(false);
    setUtr("");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {status === "pending" && (
            <DropdownMenuItem onSelect={approve}>Approve + dispatch now</DropdownMenuItem>
          )}
          {(status === "pending" || status === "processing") && (
            <DropdownMenuItem
              onSelect={() => setRejectOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              Reject
            </DropdownMenuItem>
          )}
          {status !== "completed" && (
            <DropdownMenuItem onSelect={() => setMarkOpen(true)}>
              Mark completed (manual)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject payout</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason emailed to the seller"
          />
          <DialogFooter>
            <Button variant="destructive" onClick={reject} disabled={busy || !reason.trim()}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark payout completed</DialogTitle>
          </DialogHeader>
          <Label className="text-xs">UTR / reference</Label>
          <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="HDFC0XXX..." />
          <DialogFooter>
            <Button onClick={markCompleted} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Mark completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
