"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { requestPayoutAction } from "@/actions/payouts";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payouts/constants";
import { Button } from "@/components/ui/button";
// MIN_PAYOUT_AMOUNT is the compile-time fallback; the live platform minimum
// is read from settings server-side and passed in via `minPayout`.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function RequestPayoutDialog({
  available,
  minPayout = MIN_PAYOUT_AMOUNT,
}: {
  available: number;
  minPayout?: number;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const result = await requestPayoutAction(n);
    setSubmitting(false);
    if (!result.ok) {
      toast({
        title: "Couldn't request payout",
        description: result.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Payout queued",
      description: "We'll process it within 2 business days.",
    });
    setOpen(false);
    setAmount("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={available < minPayout}>
          Request payout
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request a payout</DialogTitle>
          <DialogDescription>
            Minimum ₹{minPayout.toLocaleString("en-IN")}. You have ₹
            {available.toLocaleString("en-IN")} available.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Amount (INR)</Label>
          <Input
            type="number"
            min={minPayout}
            max={available}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(minPayout)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
