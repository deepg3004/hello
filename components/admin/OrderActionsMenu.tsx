"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical } from "lucide-react";

import { adminRefundOrderAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export function OrderActionsMenu({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    if (!confirm(`${label}?`)) return;
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Action failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: r.message ?? label.replace(/\?$/, "") });
    router.refresh();
  }

  async function refundPartial() {
    const input = prompt(
      "Partial refund amount in ₹ (leave blank to refund the full order):",
    );
    if (input === null) return; // cancelled
    const trimmed = input.trim();
    const amount = trimmed === "" ? undefined : Number(trimmed);
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setBusy(true);
    const r = await adminRefundOrderAction(orderId, amount);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Refund failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: r.message ?? "Refunded" });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {status === "paid" && (
          <DropdownMenuItem asChild>
            <a
              href={`/api/orders/${orderId}/invoice`}
              target="_blank"
              rel="noreferrer"
            >
              Download GST invoice
            </a>
          </DropdownMenuItem>
        )}
        {(status === "paid" || status === "partially_refunded") && (
          <>
            <DropdownMenuItem
              onSelect={() =>
                run("Refund this order in full", () => adminRefundOrderAction(orderId))
              }
              className="text-destructive focus:text-destructive"
            >
              Refund (full)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={refundPartial}
              className="text-destructive focus:text-destructive"
            >
              Refund partial amount…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
