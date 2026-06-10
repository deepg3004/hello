"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Clock } from "lucide-react";

import { requestRefundAction } from "@/actions/buyer-account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Props {
  orderId: string;
  /** Order status — only "paid" orders can be refunded. */
  status: string;
  /** "none" | "requested" | "declined" */
  refundRequestStatus?: string | null;
}

/** Buyer-initiated refund request on a paid order. Submits a tracked request
 *  that lands in the seller's transactions queue (and pings them). */
export function RequestRefundButton({ orderId, status, refundRequestStatus }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(refundRequestStatus === "requested");

  // Only paid orders are eligible; refunded orders show nothing here.
  if (status !== "paid") return null;

  if (requested) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Clock className="h-3.5 w-3.5" />
        Refund requested
      </span>
    );
  }

  async function submit() {
    setBusy(true);
    const r = await requestRefundAction(orderId, reason);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't submit", description: r.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Refund requested",
      description: "The seller has been notified and will review it.",
    });
    setRequested(true);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Request refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Why are you requesting a refund?</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the seller what went wrong…"
            />
            <p className="text-[11px] text-muted-foreground">
              This goes to the seller, who decides whether to approve it. Refunds
              are at the seller&apos;s discretion.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || reason.trim().length < 5}>
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
