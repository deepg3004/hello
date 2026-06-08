"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import { cn } from "@/lib/utils";

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * A self-skinned <video> with our OWN controls — no native browser controls and
 * no third-party player chrome/logo. Used for direct and HLS course videos.
 * For HLS the parent attaches hls.js via the `onVideoEl` callback (src stays
 * undefined); for a direct file/URL the parent passes `src`.
 */
export function CustomVideo({
  src,
  onVideoEl,
  onToggleFullscreen,
  isFs,
}: {
  src?: string;
  onVideoEl?: (el: HTMLVideoElement | null) => void;
  onToggleFullscreen?: () => void;
  isFs?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [waiting, setWaiting] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onVideoEl?.(ref.current);
    return () => onVideoEl?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = ref.current;
    if (!v || !dur) return;
    v.currentTime = (Number(e.target.value) / 100) * dur;
  }
  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }
  function onVol(e: React.ChangeEvent<HTMLInputElement>) {
    const v = ref.current;
    if (!v) return;
    const nv = Number(e.target.value);
    v.volume = nv;
    v.muted = nv === 0;
    setVol(nv);
    setMuted(nv === 0);
  }
  function nudge() {
    setShowBar(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (ref.current && !ref.current.paused) setShowBar(false);
    }, 2500);
  }

  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <div
      className="relative h-full w-full"
      onMouseMove={nudge}
      onMouseLeave={() => {
        if (ref.current && !ref.current.paused) setShowBar(false);
      }}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        className="h-full w-full object-contain"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          nudge();
        }}
        onPause={() => {
          setPlaying(false);
          setShowBar(true);
        }}
        onTimeUpdate={() => setCur(ref.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          setDur(ref.current?.duration ?? 0);
          setVol(ref.current?.volume ?? 1);
          setMuted(ref.current?.muted ?? false);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
      />

      {/* Center play / buffering affordance */}
      {(!playing || waiting) && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="pointer-events-none absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white"
        >
          {waiting ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Play className="h-7 w-7 translate-x-0.5" />
          )}
        </button>
      )}

      {/* Custom control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 transition-opacity",
          showBar ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={seek}
          aria-label="Seek"
          className="h-1 w-full cursor-pointer accent-white"
        />
        <div className="mt-1 flex items-center gap-3 text-white">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button type="button" onClick={toggleMute} aria-label="Mute">
            {muted || vol === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : vol}
            onChange={onVol}
            aria-label="Volume"
            className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
          />
          <span className="text-xs tabular-nums">
            {fmt(cur)} / {fmt(dur)}
          </span>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
              className="ml-auto"
            >
              {isFs ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
