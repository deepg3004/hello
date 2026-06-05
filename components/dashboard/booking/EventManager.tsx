"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Copy, Loader2, Pencil, Trash2, Users } from "lucide-react";

import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  cancelRegistrationAction,
  type EventInput,
} from "@/actions/event";
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
import { useToast } from "@/hooks/use-toast";
import { formatSlotLabel } from "@/lib/booking";
import { formatINR } from "@/lib/utils";

export interface EventRegistration {
  id: string;
  name: string | null;
  email: string;
  status: string;
}
export interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  capacity: number | null;
  price: number;
  location: string | null;
  active: boolean;
  registrations: EventRegistration[];
}

// datetime-local (typed as IST) → UTC ISO.
function istLocalToIso(v: string): string | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 330 * 60_000).toISOString();
}
// UTC ISO → datetime-local value in IST.
function isoToIstLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

interface Draft {
  title: string;
  description: string;
  startLocal: string;
  endLocal: string;
  capacity: string;
  price: string;
  location: string;
  active: boolean;
}

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  startLocal: "",
  endLocal: "",
  capacity: "",
  price: "",
  location: "",
  active: true,
});

export function EventManager({
  events,
  bookingBase,
}: {
  events: EventRow[];
  bookingBase: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [viewing, setViewing] = useState<EventRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const eventUrl = (slug: string) =>
    bookingBase ? `${bookingBase.replace(/\/book\/$/, "/event/")}${slug}` : `/event/${slug}`;

  function openNew() {
    setDraft(emptyDraft());
    setEditing("new");
  }
  function openEdit(e: EventRow) {
    setDraft({
      title: e.title,
      description: e.description ?? "",
      startLocal: isoToIstLocal(e.start_at),
      endLocal: isoToIstLocal(e.end_at),
      capacity: e.capacity != null ? String(e.capacity) : "",
      price: e.price ? String(e.price) : "",
      location: e.location ?? "",
      active: e.active,
    });
    setEditing(e.id);
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    const startIso = istLocalToIso(draft.startLocal);
    const endIso = istLocalToIso(draft.endLocal);
    if (!draft.title.trim() || !startIso || !endIso) {
      toast({ variant: "destructive", title: "Title, start and end are required" });
      return;
    }
    const input: EventInput & { active?: boolean } = {
      title: draft.title,
      description: draft.description,
      start_iso: startIso,
      end_iso: endIso,
      capacity: draft.capacity ? parseInt(draft.capacity, 10) : null,
      price: draft.price ? Number(draft.price) : 0,
      location: draft.location,
      active: draft.active,
    };
    start(async () => {
      const res = editing === "new" ? await createEventAction(input) : await updateEventAction(editing!, input);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: editing === "new" ? "Event created" : "Event updated" });
      setEditing(null);
      router.refresh();
    });
  }

  function remove(e: EventRow) {
    if (!window.confirm(`Delete "${e.title}"? Registrations are removed too.`)) return;
    start(async () => {
      const res = await deleteEventAction(e.id);
      if (!res.ok) toast({ variant: "destructive", title: "Failed", description: res.message });
      else { toast({ title: "Event deleted" }); router.refresh(); }
    });
  }

  function cancelReg(id: string) {
    start(async () => {
      const res = await cancelRegistrationAction(id);
      if (!res.ok) toast({ variant: "destructive", title: "Failed", description: res.message });
      else { toast({ title: "Registration cancelled" }); router.refresh(); setViewing(null); }
    });
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  }

  const activeCount = (e: EventRow) => e.registrations.filter((r) => r.status !== "cancelled").length;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <CalendarPlus className="mr-1.5 h-4 w-4" /> New event
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No events yet. Create a group event (workshop, webinar, class) — one time, many attendees.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{e.title}</p>
                  {!e.active && <Badge variant="secondary">Hidden</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatSlotLabel(e.start_at)} (IST) · {e.price > 0 ? formatINR(Math.round(e.price * 100)) : "Free"} ·{" "}
                  {activeCount(e)}{e.capacity != null ? `/${e.capacity}` : ""} registered
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => copy(eventUrl(e.slug))} title="Copy link">
                  {copied === eventUrl(e.slug) ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setViewing(e)}>
                  <Users className="mr-1 h-3.5 w-3.5" /> {activeCount(e)}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(e)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New event" : "Edit event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Live Q&A Webinar" />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Start (IST)</Label>
                <Input type="datetime-local" value={draft.startLocal} onChange={(e) => set("startLocal", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>End (IST)</Label>
                <Input type="datetime-local" value={draft.endLocal} onChange={(e) => set("endLocal", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Capacity (blank = unlimited)</Label>
                <Input type="number" min={1} value={draft.capacity} onChange={(e) => set("capacity", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Price ₹ (0 = free)</Label>
                <Input type="number" min={0} value={draft.price} onChange={(e) => set("price", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Location / link</Label>
              <Input value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Zoom / Google Meet / address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrations */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrations — {viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && viewing.registrations.filter((r) => r.status !== "cancelled").length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No registrations yet.</p>
          ) : (
            <div className="divide-y">
              {viewing?.registrations
                .filter((r) => r.status !== "cancelled")
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name ?? r.email}</p>
                      <p className="text-xs text-muted-foreground">{r.email} · {r.status}</p>
                    </div>
                    <button onClick={() => cancelReg(r.id)} className="text-xs text-rose-500" disabled={pending}>
                      Cancel
                    </button>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
