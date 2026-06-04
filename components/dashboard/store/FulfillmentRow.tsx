"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { updateFulfillmentAction } from "@/actions/store";

type Status = "unfulfilled" | "packed" | "shipped" | "delivered";

export interface FulfillmentOrder {
  id: string;
  buyer_name: string | null;
  buyer_email: string;
  product_name: string | null;
  amount: number;
  shipping_fee: number;
  address_lines: string[];
  fulfillment_status: Status;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
}

const STATUSES: Status[] = ["unfulfilled", "packed", "shipped", "delivered"];

export function FulfillmentRow({ order }: { order: FulfillmentOrder }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(order.fulfillment_status);
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url ?? "");

  function save() {
    start(async () => {
      const res = await updateFulfillmentAction({
        order_id: order.id,
        fulfillment_status: status,
        tracking_number: tracking,
        tracking_url: trackingUrl,
      });
      toast(
        res.ok
          ? { title: "Saved" }
          : { variant: "destructive", title: "Couldn't save", description: res.message },
      );
    });
  }

  return (
    <div className="card-surface space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{order.product_name ?? "Order"}</p>
          <p className="text-xs text-muted-foreground">
            {order.buyer_name ?? order.buyer_email} ·{" "}
            {new Date(order.created_at).toLocaleDateString("en-IN")}
          </p>
        </div>
        <p className="text-sm font-medium">
          ₹{order.amount.toLocaleString("en-IN")}
          {order.shipping_fee > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              (incl ₹{order.shipping_fee.toLocaleString("en-IN")} shipping)
            </span>
          )}
        </p>
      </div>

      {order.address_lines.length > 0 && (
        <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {order.address_lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking #"
          className="h-9 w-36"
        />
        <Input
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          placeholder="Tracking URL"
          className="h-9 flex-1 min-w-[160px]"
        />
        <Button size="sm" onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
