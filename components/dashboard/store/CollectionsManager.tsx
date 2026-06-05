"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Layers, Loader2, Pencil, Trash2 } from "lucide-react";

import {
  createCollectionAction,
  updateCollectionAction,
  deleteCollectionAction,
  setCollectionProductsAction,
} from "@/actions/store";
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
import { useToast } from "@/hooks/use-toast";

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  productIds: string[];
}

export interface ProductOption {
  id: string;
  name: string;
}

export function CollectionsManager({
  collections,
  allProducts,
  storeUrl,
}: {
  collections: CollectionRow[];
  allProducts: ProductOption[];
  storeUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [editing, setEditing] = useState<CollectionRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [assigning, setAssigning] = useState<CollectionRow | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function openNew() {
    setName("");
    setDescription("");
    setImageUrl("");
    setEditing("new");
  }
  function openEdit(c: CollectionRow) {
    setName(c.name);
    setDescription(c.description ?? "");
    setImageUrl(c.image_url ?? "");
    setEditing(c);
  }

  function saveCollection() {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }
    start(async () => {
      const res =
        editing === "new"
          ? await createCollectionAction({ name, description, image_url: imageUrl })
          : await updateCollectionAction((editing as CollectionRow).id, {
              name,
              description,
              image_url: imageUrl,
            });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: editing === "new" ? "Collection created" : "Collection updated" });
      setEditing(null);
      router.refresh();
    });
  }

  function remove(c: CollectionRow) {
    if (!window.confirm(`Delete the "${c.name}" collection? (Products are not deleted.)`)) return;
    start(async () => {
      const res = await deleteCollectionAction(c.id);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't delete", description: res.message });
        return;
      }
      toast({ title: "Collection deleted" });
      router.refresh();
    });
  }

  function openAssign(c: CollectionRow) {
    setPicked(new Set(c.productIds));
    setAssigning(c);
  }
  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function saveAssign() {
    if (!assigning) return;
    start(async () => {
      const res = await setCollectionProductsAction(assigning.id, Array.from(picked));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: "Products updated" });
      setAssigning(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <FolderPlus className="mr-1.5 h-4 w-4" /> New collection
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <Layers className="h-6 w-6" />
          No collections yet. Group products into collections to merchandise your
          storefront.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {collections.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.productIds.length} product{c.productIds.length === 1 ? "" : "s"}
                  {storeUrl ? ` · /c/${c.slug}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => openAssign(c)}>
                  Products
                </Button>
                {storeUrl && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`${storeUrl}/c/${c.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(c)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit collection */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New collection" : "Edit collection"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bestsellers" />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveCollection} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign products */}
      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Products in {assigning?.name}</DialogTitle>
          </DialogHeader>
          {allProducts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              You have no active products to add yet.
            </p>
          ) : (
            <div className="space-y-1">
              {allProducts.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => togglePick(p.id)} />
                  <span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveAssign} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save ({picked.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
