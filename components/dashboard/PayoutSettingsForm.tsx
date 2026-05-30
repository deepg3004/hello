"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updatePayoutSettingsAction } from "@/actions/payouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payouts/constants";

interface PayoutSettingsFormProps {
  initialSchedule: "manual" | "weekly" | "monthly";
  initialThreshold: number;
  initialGateway: "razorpay" | "cashfree" | "manual";
}

export function PayoutSettingsForm({
  initialSchedule,
  initialThreshold,
  initialGateway,
}: PayoutSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [threshold, setThreshold] = useState(String(initialThreshold));
  const [gateway, setGateway] = useState<"razorpay" | "cashfree">(
    initialGateway === "manual" ? "razorpay" : initialGateway,
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    schedule !== initialSchedule ||
    Number(threshold) !== initialThreshold ||
    gateway !== initialGateway;

  async function save() {
    setSaving(true);
    const r = await updatePayoutSettingsAction({
      schedule,
      min_threshold: Number(threshold),
      gateway,
    });
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Payout schedule</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Manual = request whenever you like. Weekly/monthly auto-files a
          request when the balance crosses your threshold.
        </p>
        <Select value={schedule} onValueChange={(v) => setSchedule(v as typeof schedule)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Minimum payout amount (INR)</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Platform minimum is ₹{MIN_PAYOUT_AMOUNT}. You can raise this to save
          on per-payout charges.
        </p>
        <Input
          type="number"
          min={MIN_PAYOUT_AMOUNT}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Payout gateway</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          We default to Razorpay. Switch to Cashfree if your bank rejects RazorpayX transfers.
        </p>
        <Select value={gateway} onValueChange={(v) => setGateway(v as "razorpay" | "cashfree")}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="razorpay">Razorpay (recommended)</SelectItem>
            <SelectItem value="cashfree">Cashfree</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={save} disabled={!dirty || saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save settings
      </Button>
    </div>
  );
}
