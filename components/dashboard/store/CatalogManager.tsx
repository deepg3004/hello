"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, PackageOpen, Layers } from "lucide-react";

import {
  createCatalogProductAction,
  updateCatalogProductAction,
  deleteCatalogProductAction,
  setProductVariantsAction,
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

export interface CatalogVariant {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  sku: string | null;
  active: boolean;
}

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
  variants: CatalogVariant[];
}

type Draft = CatalogProductInput & { active: boolean };

interface VariantRow {
  name: string;
  price: number;
  stock: number | null;
  sku: string | null;
}

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
  const [variantFor, setVariantFor] = useState<CatalogProduct | null>(null);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

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

  function openVariants(p: CatalogProduct) {
    setVariantFor(p);
    setVariantRows(
      p.variants.map((v) => ({ name: v.name, price: v.price, stock: v.stock, sku: v.sku })),
    );
  }
  const setRow = (i: number, patch: Partial<VariantRow>) =>
    setVariantRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setVariantRows((rows) => [...rows, { name: "", price: 0, stock: null, sku: null }]);
  const removeRow = (i: number) =>
    setVariantRows((rows) => rows.filter((_, idx) => idx !== i));

  function saveVariants() {
    if (!variantFor) return;
    const bad = variantRows.find((r) => r.name.trim() && !(Number(r.price) > 0));
    if (bad) {
      toast({ variant: "destructive", title: `Set a price for "${bad.name.trim()}"` });
      return;
    }
    const product = variantFor;
    start(async () => {
      const res = await setProductVariantsAction(
        product.id,
        variantRows
          .filter((r) => r.name.trim())
          .map((r) => ({ name: r.name, price: Number(r.price), stock: r.stock, sku: r.sku })),
      );
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save options", description: res.message });
        return;
      }
      toast({ title: "Options saved" });
      setVariantFor(null);
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
                  {p.variants.length > 0 ? ` · ${p.variants.length} option${p.variants.length === 1 ? "" : "s"}` : ""}
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
                <Button variant="ghost" size="icon" title="Options / variants" onClick={() => openVariants(p)}>
                  <Layers className="h-4 w-4" />
                </Button>
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

      <Dialog open={!!variantFor} onOpenChange={(o) => !o && setVariantFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Options — {variantFor?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Add variants (e.g. sizes, plans) buyers pick from. Each has its own
            price and stock. Leave empty to sell the product as-is.
          </p>
          <div className="space-y-2">
            {variantRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No options yet.</p>
            ) : (
              variantRows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-lg border p-2">
                  <div className="grid gap-2">
                    <Input
                      value={r.name}
                      placeholder="Option name (e.g. Large)"
                      onChange={(e) => setRow(i, { name: e.target.value })}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Price ₹"
                        value={r.price || ""}
                        onChange={(e) => setRow(i, { price: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Stock"
                        value={r.stock ?? ""}
                        onChange={(e) => setRow(i, { stock: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                      <Input
                        placeholder="SKU"
                        value={r.sku ?? ""}
                        onChange={(e) => setRow(i, { sku: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1.5 h-4 w-4" /> Add option
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveVariants} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
