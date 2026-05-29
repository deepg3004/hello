"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { approveKycAction, rejectKycAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function KycReviewActions({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  async function approve() {
    if (!confirm("Approve this KYC and unlock payouts?")) return;
    setBusy("approve");
    const r = await approveKycAction(submissionId);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Approve failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "KYC approved" });
    router.refresh();
  }

  async function reject() {
    setBusy("reject");
    const r = await rejectKycAction(submissionId, reason);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Reject failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "KYC rejected" });
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={approve} disabled={busy !== null}>
        {busy === "approve" ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="mr-2 h-3.5 w-3.5" />
        )}
        Approve
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive">
            <X className="mr-2 h-3.5 w-3.5" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject KYC submission</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason emailed to the user"
          />
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={busy === "reject" || !reason.trim()}
            >
              {busy === "reject" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
