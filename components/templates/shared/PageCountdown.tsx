"use client";

// Page-level countdown bar — separate from per-template heroes' Countdown.
// Reads page_config.countdown_config; supports fixed-date and evergreen
// (cookie-persisted) timers; positions itself as a sticky top bar.

import { useEffect, useMemo, useState } from "react";

import type { CountdownConfig } from "@/lib/conversion";
import { resolvedCountdown } from "@/lib/conversion";

interface PageCountdownProps {
  pageSlug: string;
  config: CountdownConfig;
  /** Suppress the widget in preview. */
  isPreview?: boolean;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

function writeCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 86_400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/`;
}

interface Tick {
  d: number;
  h: number;
  m: number;
  s: number;
  expired: boolean;
}

function diff(targetMs: number): Tick {
  const ms = targetMs - Date.now();
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return { d, h, m, s, expired: false };
}

export function PageCountdown({ pageSlug, config, isPreview }: PageCountdownProps) {
  const cfg = useMemo(() => resolvedCountdown(config), [config]);
  const [targetMs, setTargetMs] = useState<number | null>(null);
  const [tick, setTick] = useState<Tick>({ d: 0, h: 0, m: 0, s: 0, expired: false });

  // Resolve the target on mount. Fixed = config.target. Evergreen = cookie-
  // based start + duration_hours.
  useEffect(() => {
    if (!cfg.enabled) return;
    if (cfg.type === "fixed") {
      const parsed = cfg.target ? Date.parse(cfg.target) : NaN;
      if (Number.isFinite(parsed)) setTargetMs(parsed);
      return;
    }

    // Evergreen
    const cookieKey = `${pageSlug}_timer_start`;
    let start = Number(readCookie(cookieKey));
    if (!Number.isFinite(start) || start <= 0) {
      start = Date.now();
      writeCookie(cookieKey, String(start));
    }
    const durationMs = (cfg.duration_hours ?? 24) * 3_600_000;
    setTargetMs(start + durationMs);
  }, [cfg, pageSlug]);

  useEffect(() => {
    if (targetMs == null) return;
    setTick(diff(targetMs));
    const id = setInterval(() => setTick(diff(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!cfg.enabled) return null;
  if (isPreview) return null;
  if (targetMs == null) return null;

  // Expired branch
  if (tick.expired) {
    if (cfg.expiry_behavior === "redirect" && cfg.expiry_redirect_url) {
      if (typeof window !== "undefined") {
        window.location.href = cfg.expiry_redirect_url;
      }
      return null;
    }
    if (cfg.expiry_behavior === "show_expired") {
      return (
        <div
          className="sticky top-0 z-40 px-4 py-2 text-center text-sm font-medium"
          style={{ background: cfg.bg_color, color: cfg.text_color }}
        >
          {cfg.expiry_text ?? "Offer expired."}
        </div>
      );
    }
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const showDays = tick.d > 0;

  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium"
      style={{ background: cfg.bg_color, color: cfg.text_color }}
    >
      <span className="hidden sm:inline">{cfg.label}</span>
      <span className="font-mono tabular-nums">
        {showDays && `${tick.d}d `}
        {pad(tick.h)}:{pad(tick.m)}:{pad(tick.s)}
      </span>
    </div>
  );
}
