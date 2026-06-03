"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCheck,
  FileText,
  IndianRupee,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { playOrderSound, unlockAudio } from "@/lib/notifications/sound";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

// Per-type icon + tinted tile. Keys mirror lib/notifications/events.ts. Any
// unknown type falls back to a neutral bell so a new event never renders bare.
// Dark-aware tile classes (globals.css) carry the gradient + ring + icon colour.
const ICONS: Record<string, { Icon: LucideIcon; tile: string }> = {
  payment_received: { Icon: IndianRupee, tile: "tile-emerald" },
  page_created: { Icon: FileText, tile: "tile-indigo" },
  kyc_approved: { Icon: ShieldCheck, tile: "tile-emerald" },
  kyc_rejected: { Icon: ShieldX, tile: "tile-rose" },
  kyc_flagged: { Icon: ShieldAlert, tile: "tile-amber" },
  kyc_rekyc: { Icon: RotateCcw, tile: "tile-amber" },
  telegram_join: { Icon: Send, tile: "tile-indigo" },
  wallet_low_balance: { Icon: Wallet, tile: "tile-amber" },
};

const FALLBACK = { Icon: Bell, tile: "tile-neutral" };

function iconFor(type: string) {
  return ICONS[type] ?? FALLBACK;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

const SOUND_KEY = "invox-notif-sound";

interface NotificationBellProps {
  /** Tints the trigger focus ring to match the shell (seller vs admin). */
  accent?: "indigo" | "amber";
}

export function NotificationBell({ accent = "indigo" }: NotificationBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [popups, setPopups] = useState<Notif[]>([]);
  // Avoid overlapping fetches (realtime burst + poll + open).
  const inflight = useRef(false);
  // Read inside the realtime closure without re-subscribing on toggle.
  const soundRef = useRef(true);

  // Read through the server route (authed via the session cookie) so the feed
  // never comes back empty due to a browser-side RLS/session quirk.
  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { items: Notif[]; unread: number };
        setItems(json.items ?? []);
        setUnread(json.unread ?? 0);
      }
    } catch (e) {
      console.error("[bell] refresh failed", e);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, []);

  // Mount: portal flag, sound preference, audio unlock on first gesture.
  useEffect(() => {
    setMounted(true);
    try {
      const pref = window.localStorage.getItem(SOUND_KEY);
      const on = pref !== "0";
      setSoundOn(on);
      soundRef.current = on;
    } catch {
      /* ignore */
    }
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Initial load.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the user id once — drives the realtime channel filter below.
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (active && user) setUserId(user.id);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const dismissPopup = useCallback((id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const pushPopup = useCallback(
    (row: Notif) => {
      setPopups((prev) => [row, ...prev.filter((p) => p.id !== row.id)].slice(0, 4));
      window.setTimeout(() => dismissPopup(row.id), 6500);
    },
    [dismissPopup],
  );

  // Realtime + polling + focus refetch (once we know the user).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // A brand-new notification → sound + top-right popup.
          if (payload.eventType === "INSERT" && payload.new) {
            const row = payload.new as Notif;
            pushPopup(row);
            if (soundRef.current) playOrderSound();
          }
          void refresh();
        },
      )
      .subscribe();

    const interval = setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, supabase, refresh, pushPopup]);

  function toggleSound() {
    setSoundOn((prev) => {
      const next = !prev;
      soundRef.current = next;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) {
        unlockAudio();
        playOrderSound(); // preview on enable
      }
      return next;
    });
  }

  async function markAllRead() {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  const markReadById = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((x) => (x.id === id && !x.read_at ? { ...x, read_at: now } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    [],
  );

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) void refresh();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            className={cn(
              "relative text-muted-foreground hover:text-foreground",
              accent === "amber"
                ? "focus-visible:ring-amber-500"
                : "focus-visible:ring-primary",
            )}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
                  "rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white",
                )}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[360px] overflow-hidden p-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-sora text-sm font-semibold tracking-tight">
                Notifications
              </span>
              {unread > 0 && (
                <span className="badge-info rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundOn ? "Mute notification sound" : "Unmute notification sound"}
                title={soundOn ? "Sound on" : "Sound off"}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {soundOn ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full tile-indigo">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground">
                  New activity will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const cfg = iconFor(n.type);
                  const Row = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors",
                        n.link && "cursor-pointer hover:bg-muted/50",
                        !n.read_at && "bg-indigo-500/[0.06] dark:bg-indigo-500/10",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          cfg.tile,
                        )}
                      >
                        <cfg.Icon className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {n.title}
                          </p>
                          {!n.read_at && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            markReadById(n.id);
                            setOpen(false);
                          }}
                        >
                          {Row}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => markReadById(n.id)}
                        >
                          {Row}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Top-right live popups — portaled to <body> so the topbar's
          backdrop-blur (a containing block for fixed) can't trap them. */}
      {mounted &&
        popups.length > 0 &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
            {popups.map((p) => {
              const cfg = iconFor(p.type);
              const inner = (
                <div className="flex items-start gap-3 p-3.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      cfg.tile,
                    )}
                  >
                    <cfg.Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {p.title}
                    </p>
                    {p.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.body}
                      </p>
                    )}
                  </div>
                </div>
              );
              return (
                <div
                  key={p.id}
                  className="pointer-events-auto relative overflow-hidden rounded-xl border border-border bg-card shadow-card-lg animate-in fade-in slide-in-from-top-2 slide-in-from-right-2 duration-300"
                >
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => dismissPopup(p.id)}
                    className="absolute right-1.5 top-1.5 z-10 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {p.link ? (
                    <Link
                      href={p.link}
                      onClick={() => {
                        markReadById(p.id);
                        dismissPopup(p.id);
                      }}
                      className="block pr-6"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="pr-6">{inner}</div>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
