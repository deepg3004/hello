"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { updateProductPhysicalAction } from "@/actions/store";

export interface StoreProduct {
  page_id: string;
  name: string;
  page_title: string | null;
  requires_shipping: boolean;
  stock: number | null;
  sku: string | null;
}

function Row({ p }: { p: StoreProduct }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [physical, setPhysical] = useState(p.requires_shipping);
  const [tracked, setTracked] = useState(p.stock !== null);
  const [stock, setStock] = useState(p.stock !== null ? String(p.stock) : "");
  const [sku, setSku] = useState(p.sku ?? "");

  function save() {
    start(async () => {
      const res = await updateProductPhysicalAction({
        page_id: p.page_id,
        requires_shipping: physical,
        stock: tracked ? Number(stock) || 0 : null,
        sku,
      });
      toast(
        res.ok
          ? { title: "Saved" }
          : { variant: "destructive", title: "Couldn't save", description: res.message },
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-[160px] flex-1">
        <p className="truncate text-sm font-medium">{p.name}</p>
        {p.page_title && (
          <p className="truncate text-xs text-muted-foreground">{p.page_title}</p>
        )}
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={physical}
          onChange={(e) => setPhysical(e.target.checked)}
        />
        Physical
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={tracked}
          onChange={(e) => setTracked(e.target.checked)}
        />
        Track stock
      </label>
      {tracked && (
        <Input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Qty"
          className="h-9 w-24"
        />
      )}
      <Input
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        placeholder="SKU"
        className="h-9 w-32"
      />
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
    </div>
  );
}

export function ProductInventoryManager({
  products,
}: {
  products: StoreProduct[];
}) {
  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No products yet. Create a payment page to add products.
      </p>
    );
  }
  return (
    <div>
      {products.map((p) => (
        <Row key={p.page_id} p={p} />
      ))}
    </div>
  );
}
