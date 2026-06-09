"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";

import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
  type AddressInput,
} from "@/actions/buyer-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export interface SavedAddress {
  id: string;
  full_name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  pincode: string;
  country: string;
  is_default: boolean;
}

const EMPTY: AddressInput = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  is_default: false,
};

export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<AddressInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    setBusy(true);
    const r = await saveAddressAction(editing);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Not saved", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Address saved" });
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    setActionId(id);
    const r = await deleteAddressAction(id);
    setActionId(null);
    if (!r.ok) {
      toast({ title: "Couldn't delete", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  async function makeDefault(id: string) {
    setActionId(id);
    const r = await setDefaultAddressAction(id);
    setActionId(null);
    if (!r.ok) {
      toast({ title: "Couldn't update", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  function set<K extends keyof AddressInput>(key: K, val: AddressInput[K]) {
    setEditing((e) => (e ? { ...e, [key]: val } : e));
  }

  // ── Add / edit form ──────────────────────────────────────────────────
  if (editing) {
    return (
      <Card>
        <CardContent className="space-y-4 py-5">
          <h3 className="font-sora text-base font-semibold">
            {editing.id ? "Edit address" : "Add a new address"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *">
              <Input value={editing.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={editing.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
            </Field>
          </div>
          <Field label="Address line 1 *">
            <Input value={editing.line1} onChange={(e) => set("line1", e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <Input value={editing.line2} onChange={(e) => set("line2", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City *">
              <Input value={editing.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="State">
              <Input value={editing.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="PIN code *">
              <Input value={editing.pincode} onChange={(e) => set("pincode", e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Country">
            <Input value={editing.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!editing.is_default}
              onChange={(e) => set("is_default", e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Set as my default address
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save address
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Save an address to speed up checkout on physical-product orders."
        />
      ) : (
        addresses.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Home className="h-3.5 w-3.5 text-muted-foreground" />
                  {a.full_name}
                  {a.is_default && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {[a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ")}
                </p>
                {a.phone && <p className="text-muted-foreground">{a.phone}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
                {!a.is_default && (
                  <Button variant="outline" size="sm" onClick={() => makeDefault(a.id)} disabled={actionId === a.id}>
                    {actionId === a.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Star className="mr-1.5 h-3.5 w-3.5" />}
                    Default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEditing({
                      id: a.id,
                      full_name: a.full_name,
                      phone: a.phone ?? "",
                      line1: a.line1,
                      line2: a.line2 ?? "",
                      city: a.city,
                      state: a.state ?? "",
                      pincode: a.pincode,
                      country: a.country,
                      is_default: a.is_default,
                    })
                  }
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)} disabled={actionId === a.id}>
                  {actionId === a.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
