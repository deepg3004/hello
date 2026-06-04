"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateShippingConfigAction } from "@/actions/store";

export function ShippingRatesForm({
  flatFee,
  freeOver,
}: {
  flatFee: number;
  freeOver: number | null;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [flat, setFlat] = useState(String(flatFee || ""));
  const [free, setFree] = useState(freeOver ? String(freeOver) : "");

  function save() {
    start(async () => {
      const res = await updateShippingConfigAction({
        shipping_flat_fee: Number(flat) || 0,
        free_shipping_over: free ? Number(free) : null,
      });
      toast(
        res.ok
          ? { title: "Shipping rates saved" }
          : { variant: "destructive", title: "Couldn't save", description: res.message },
      );
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-xs">Flat shipping fee (₹)</Label>
        <Input
          type="number"
          min={0}
          value={flat}
          onChange={(e) => setFlat(e.target.value)}
          placeholder="0"
          className="mt-1 w-40"
        />
      </div>
      <div>
        <Label className="text-xs">Free shipping over (₹, optional)</Label>
        <Input
          type="number"
          min={0}
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="e.g. 999"
          className="mt-1 w-48"
        />
      </div>
      <Button onClick={save} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save rates
      </Button>
    </div>
  );
}
