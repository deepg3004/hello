"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, Copy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatSlotLabel } from "@/lib/booking";
import {
  createBookingTypeAction,
  updateBookingTypeAction,
  deleteBookingTypeAction,
  cancelBookingAction,
  rescheduleBookingAction,
  type AvailabilityInput,
} from "@/actions/booking";

// datetime-local value (seller types it as IST) → UTC ISO instant.
function istLocalToIso(v: string): string | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - 330 * 60_000;
  return new Date(utc).toISOString();
}

export interface BookingTypeData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  price: number;
  location: string | null;
  active: boolean;
  availability: AvailabilityInput[];
}
export interface UpcomingBooking {
  id: string;
  title: string;
  buyer: string;
  start_at: string;
  status: string;
  amount: number;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface Draft {
  id: string | null;
  title: string;
  description: string;
  duration_min: number;
  buffer_min: number;
  price: number;
  location: string;
  availability: AvailabilityInput[];
}

const emptyDraft = (): Draft => ({
  id: null,
  title: "",
  description: "",
  duration_min: 30,
  buffer_min: 0,
  price: 0,
  location: "",
  availability: [{ weekday: 1, start_min: 540, end_min: 1020 }],
});

export function BookingManager({
  bookingTypes,
  upcoming,
  bookingBase,
}: {
  bookingTypes: BookingTypeData[];
  upcoming: UpcomingBooking[];
  bookingBase: string;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleVal, setRescheduleVal] = useState("");

  function openNew() {
    setDraft(emptyDraft());
  }
  function openEdit(t: BookingTypeData) {
    setDraft({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      duration_min: t.duration_min,
      buffer_min: t.buffer_min,
      price: t.price,
      location: t.location ?? "",
      availability: t.availability.length
        ? t.availability
        : [{ weekday: 1, start_min: 540, end_min: 1020 }],
    });
  }

  function save() {
    if (!draft) return;
    const payload = {
      title: draft.title,
      description: draft.description,
      duration_min: draft.duration_min,
      buffer_min: draft.buffer_min,
      price: draft.price,
      location: draft.location,
      availability: draft.availability,
    };
    start(async () => {
      const res = draft.id
        ? await updateBookingTypeAction(draft.id, payload)
        : await createBookingTypeAction(payload);
      if (res.ok) {
        toast({ title: draft.id ? "Saved" : "Booking type created" });
        setDraft(null);
      } else {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteBookingTypeAction(id);
      toast(res.ok ? { title: "Deleted" } : { variant: "destructive", title: "Couldn't delete", description: res.message });
    });
  }
  function cancel(id: string) {
    start(async () => {
      const res = await cancelBookingAction(id);
      toast(res.ok ? { title: "Booking cancelled" } : { variant: "destructive", title: "Couldn't cancel", description: res.message });
    });
  }
  function reschedule(id: string) {
    const iso = rescheduleVal ? istLocalToIso(rescheduleVal) : null;
    if (!iso) {
      toast({ variant: "destructive", title: "Pick a date & time" });
      return;
    }
    start(async () => {
      const res = await rescheduleBookingAction(id, iso);
      if (res.ok) {
        setRescheduleId(null);
        setRescheduleVal("");
      }
      toast(res.ok ? { title: "Booking rescheduled" } : { variant: "destructive", title: "Couldn't reschedule", description: res.message });
    });
  }

  return (
    <div className="space-y-6">
      {/* Booking types */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Booking types</CardTitle>
          {!draft && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" /> New
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {draft && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{draft.id ? "Edit" : "New"} booking type</p>
                <button onClick={() => setDraft(null)} aria-label="Close">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="30-min strategy call" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" min={5} value={draft.duration_min} onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Buffer (min)</Label>
                  <Input type="number" min={0} value={draft.buffer_min} onChange={(e) => setDraft({ ...draft, buffer_min: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Price (₹, 0=free)</Label>
                  <Input type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Google Meet" />
                </div>
              </div>

              {/* Availability windows */}
              <div className="space-y-2">
                <Label className="text-xs">Weekly availability (IST)</Label>
                {draft.availability.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={w.weekday}
                      onChange={(e) => {
                        const a = [...draft.availability];
                        a[i] = { ...w, weekday: Number(e.target.value) };
                        setDraft({ ...draft, availability: a });
                      }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {WD.map((d, idx) => (
                        <option key={idx} value={idx}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={toHHMM(w.start_min)}
                      onChange={(e) => {
                        const a = [...draft.availability];
                        a[i] = { ...w, start_min: fromHHMM(e.target.value) };
                        setDraft({ ...draft, availability: a });
                      }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={toHHMM(w.end_min)}
                      onChange={(e) => {
                        const a = [...draft.availability];
                        a[i] = { ...w, end_min: fromHHMM(e.target.value) };
                        setDraft({ ...draft, availability: a });
                      }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <button
                      onClick={() => setDraft({ ...draft, availability: draft.availability.filter((_, j) => j !== i) })}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft({ ...draft, availability: [...draft.availability, { weekday: 1, start_min: 540, end_min: 1020 }] })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add window
                </Button>
              </div>

              <Button onClick={save} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {draft.id ? "Save changes" : "Create"}
              </Button>
            </div>
          )}

          {bookingTypes.length === 0 && !draft && (
            <p className="text-sm text-muted-foreground">No booking types yet.</p>
          )}
          {bookingTypes.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.duration_min} min · {t.price > 0 ? `₹${t.price.toLocaleString("en-IN")}` : "Free"}
                  {t.availability.length ? ` · ${t.availability.length} window(s)` : " · no availability"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(`${bookingBase}${t.slug}`).then(() => toast({ title: "Link copied" }))}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                >
                  <Copy className="h-3 w-3" /> Link
                </button>
                <Button size="sm" variant="outline" onClick={() => openEdit(t)}>Edit</Button>
                <button onClick={() => remove(t.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Upcoming bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
          ) : (
            upcoming.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.buyer} · {formatSlotLabel(b.start_at)} (IST)
                    {b.status === "pending" ? " · awaiting payment" : ""}
                  </p>
                  {rescheduleId === b.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        type="datetime-local"
                        value={rescheduleVal}
                        onChange={(e) => setRescheduleVal(e.target.value)}
                        className="h-8 w-auto text-xs"
                      />
                      <Button size="sm" onClick={() => reschedule(b.id)} disabled={pending}>
                        Save
                      </Button>
                      <button onClick={() => setRescheduleId(null)} className="text-xs text-muted-foreground">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setRescheduleId(rescheduleId === b.id ? null : b.id);
                      setRescheduleVal("");
                    }}
                    className="text-xs text-primary"
                  >
                    Reschedule
                  </button>
                  <button onClick={() => cancel(b.id)} className="text-xs text-rose-500">
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
