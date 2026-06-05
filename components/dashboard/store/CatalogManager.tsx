"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, PackageOpen } from "lucide-react";

import {
  createCatalogProductAction,
  updateCatalogProductAction,
  deleteCatalogProductAction,
  type CatalogProductInput,
} from "@/actions/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/utils";

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  category: string | null;
  requires_shipping: boolean;
  stock: number | null;
  sku: string | null;
  active: boolean;
  slug: string | null;
}

type Draft = CatalogProductInput & { active: boolean };

function emptyDraft(): Draft {
  return {
    name: "",
    price: 0,
    description: "",
    image_url: "",
    category: "",
    requires_shipping: false,
    stock: null,
    sku: "",
    active: true,
  };
}

export function CatalogManager({
  products,
  storeUrl,
}: {
  products: CatalogProduct[];
  storeUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null); // product id or "new"
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  function openNew() {
    setDraft(emptyDraft());
    setEditing("new");
  }
  function openEdit(p: CatalogProduct) {
    setDraft({
      name: p.name,
      price: p.price,
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      category: p.category ?? "",
      requires_shipping: p.requires_shipping,
      stock: p.stock,
      sku: p.sku ?? "",
      active: p.active,
    });
    setEditing(p.id);
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    if (!draft.name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }
    if (!(Number(draft.price) > 0)) {
      toast({ variant: "destructive", title: "Price must be greater than 0" });
      return;
    }
    start(async () => {
      const res =
        editing === "new"
          ? await createCatalogProductAction(draft)
          : await updateCatalogProductAction(editing!, draft);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: editing === "new" ? "Product added" : "Product updated" });
      setEditing(null);
      router.refresh();
    });
  }

  function remove(p: CatalogProduct) {
    if (!window.confirm(`Remove "${p.name}" from your store?`)) return;
    start(async () => {
      const res = await deleteCatalogProductAction(p.id);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't remove", description: res.message });
        return;
      }
      toast({ title: "Product removed" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add product
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <PackageOpen className="h-6 w-6" />
          No catalog products yet. Add one — it gets its own checkout page and
          shows on your storefront automatically.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  <PackageOpen className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{p.name}</p>
                  {!p.active && <Badge variant="secondary">Hidden</Badge>}
                  {p.requires_shipping && <Badge variant="outline">Physical</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatINR(Math.round(p.price * 100))}
                  {p.category ? ` · ${p.category}` : ""}
                  {p.stock != null ? ` · ${p.stock} in stock` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {storeUrl && p.slug && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`${storeUrl}/${p.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remove(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add product" : "Edit product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Product name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.price || ""}
                  onChange={(e) => set("price", Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Input value={draft.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Ebooks" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Image URL</Label>
              <Input value={draft.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Physical product</p>
                <p className="text-xs text-muted-foreground">Collect a delivery address at checkout.</p>
              </div>
              <Switch checked={draft.requires_shipping} onCheckedChange={(v) => set("requires_shipping", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Stock (blank = untracked)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.stock ?? ""}
                  onChange={(e) => set("stock", e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>SKU</Label>
                <Input value={draft.sku ?? ""} onChange={(e) => set("sku", e.target.value)} />
              </div>
            </div>
            {editing !== "new" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Visible in store</p>
                  <p className="text-xs text-muted-foreground">Hide to take it off your storefront.</p>
                </div>
                <Switch checked={draft.active} onCheckedChange={(v) => set("active", v)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
