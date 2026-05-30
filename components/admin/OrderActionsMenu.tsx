"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical } from "lucide-react";

import {
  adminMarkOrderPaidAction,
  adminRefundOrderAction,
} from "@/actions/admin";
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
    toast({ title: label.replace(/\?$/, "") });
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
        {status === "paid" && (
          <DropdownMenuItem
            onSelect={() =>
              run("Refund this order", () => adminRefundOrderAction(orderId))
            }
            className="text-destructive focus:text-destructive"
          >
            Refund
          </DropdownMenuItem>
        )}
        {status !== "paid" && (
          <DropdownMenuItem
            onSelect={() =>
              run("Mark order as paid", () => adminMarkOrderPaidAction(orderId))
            }
          >
            Mark as paid
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
