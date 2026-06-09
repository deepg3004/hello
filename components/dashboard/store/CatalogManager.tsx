"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, PackageOpen, Layers, Images, Upload } from "lucide-react";

import {
  createCatalogProductAction,
  updateCatalogProductAction,
  deleteCatalogProductAction,
  setProductVariantsAction,
  setProductImagesAction,
  importCatalogCsvAction,
  type CatalogProductInput,
  type ProductType,
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
import { ImageUpload } from "@/components/ui/image-upload";
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
  original_price: number | null;
  description: string | null;
  image_url: string | null;
  category: string | null;
  requires_shipping: boolean;
  stock: number | null;
  sku: string | null;
  active: boolean;
  product_type: ProductType;
  file_url: string | null;
  file_name: string | null;
  download_limit: number | null;
  slug: string | null;
  variants: CatalogVariant[];
  images: string[];
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
    original_price: null,
    description: "",
    image_url: "",
    category: "",
    requires_shipping: false,
    stock: null,
    sku: "",
    active: true,
    product_type: "digital",
    file_url: "",
    file_name: "",
    download_limit: null,
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
  const [imageFor, setImageFor] = useState<CatalogProduct | null>(null);
  const [imageRows, setImageRows] = useState<string[]>([]);

  function openNew() {
    setDraft(emptyDraft());
    setEditing("new");
  }
  function openEdit(p: CatalogProduct) {
    setDraft({
      name: p.name,
      price: p.price,
      original_price: p.original_price ?? null,
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      category: p.category ?? "",
      requires_shipping: p.requires_shipping,
      stock: p.stock,
      sku: p.sku ?? "",
      active: p.active,
      product_type: p.product_type,
      file_url: p.file_url ?? "",
      file_name: p.file_name ?? "",
      download_limit: p.download_limit,
    });
    setEditing(p.id);
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const [uploadingFile, setUploadingFile] = useState(false);
  async function onPickFile(file: File) {
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/product-file", { method: "POST", body: fd });
      const b = (await res.json()) as { path?: string; name?: string; error?: string };
      if (!res.ok || !b.path) throw new Error(b.error ?? "Upload failed");
      setDraft((d) => ({ ...d, file_url: `pfile:${b.path}`, file_name: b.name ?? file.name }));
      toast({ title: "File uploaded" });
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploadingFile(false);
    }
  }

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

  function openImages(p: CatalogProduct) {
    setImageFor(p);
    setImageRows(p.images.length > 0 ? [...p.images] : [""]);
  }
  function saveImages() {
    if (!imageFor) return;
    const product = imageFor;
    start(async () => {
      const res = await setProductImagesAction(
        product.id,
        imageRows.map((u) => u.trim()).filter(Boolean),
      );
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save images", description: res.message });
        return;
      }
      toast({ title: "Gallery saved" });
      setImageFor(null);
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

  async function onImportCsv(file: File) {
    const text = await file.text();
    start(async () => {
      const r = await importCatalogCsvAction(text);
      toast({
        title: r.ok ? "Import complete" : "Import failed",
        description: r.message,
        variant: r.ok ? undefined : "destructive",
      });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <Upload className="h-3.5 w-3.5" /> Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportCsv(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add product
        </Button>
      </div>
      <p className="text-right text-[11px] text-muted-foreground">
        CSV columns: name, price, description, category, type, stock, sku, download_limit
      </p>

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
                  {p.images.length > 0 ? ` · ${p.images.length + 1} photos` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {storeUrl && p.slug && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`${storeUrl}/store/${p.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" title="Gallery photos" onClick={() => openImages(p)}>
                  <Images className="h-4 w-4" />
                </Button>
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
                <Label>Offer price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.price || ""}
                  onChange={(e) => set("price", Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground">What the buyer pays.</p>
              </div>
              <div className="grid gap-1.5">
                <Label>MRP / real price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.original_price ?? ""}
                  onChange={(e) =>
                    set("original_price", e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="Optional"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shows struck-through with a “% off” badge when above the offer price.
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Input value={draft.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Ebooks" />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Main image</Label>
              <ImageUpload value={draft.image_url ?? ""} onChange={(v) => set("image_url", v)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Product type</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["digital", "Digital", "Downloadable file"],
                  ["physical", "Physical", "Ships to buyer"],
                  ["service", "Service", "No file / shipping"],
                ] as const).map(([val, label, hint]) => {
                  const on = (draft.product_type ?? "digital") === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => set("product_type", val)}
                      className={
                        "rounded-lg border p-2.5 text-left transition " +
                        (on ? "border-primary bg-primary/10" : "hover:bg-muted")
                      }
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(draft.product_type ?? "digital") === "digital" && (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="grid gap-1.5">
                  <Label>Downloadable file</Label>
                  {draft.file_url ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <span className="truncate">{draft.file_name || "Uploaded file"}</span>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDraft((d) => ({ ...d, file_url: "", file_name: "" }))}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted">
                      {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {uploadingFile ? "Uploading…" : "Upload file (PDF, ZIP, video… up to 50 MB)"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onPickFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Download limit (blank = unlimited)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 3"
                    value={draft.download_limit ?? ""}
                    onChange={(e) => set("download_limit", e.target.value === "" ? null : Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">Max times each buyer can download after purchase.</p>
                </div>
              </div>
            )}

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

      <Dialog open={!!imageFor} onOpenChange={(o) => !o && setImageFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gallery — {imageFor?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Extra product photos (the main image stays first). Paste image URLs —
            up to 10. Shown as a gallery on the store product page.
          </p>
          <div className="space-y-2">
            {imageRows.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <ImageUpload
                  value={url}
                  onChange={(v) => setImageRows((rows) => rows.map((r, idx) => (idx === i ? v : r)))}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive"
                  onClick={() => setImageRows((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {imageRows.length < 10 && (
              <Button variant="outline" size="sm" onClick={() => setImageRows((rows) => [...rows, ""])}>
                <Plus className="mr-1.5 h-4 w-4" /> Add photo
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveImages} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save gallery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
