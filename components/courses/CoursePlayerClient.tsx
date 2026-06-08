"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Maximize2,
  Minimize2,
  MonitorPlay,
  PlayCircle,
} from "lucide-react";

import { resolvePlaySource } from "@/lib/learn/video";
import { cn } from "@/lib/utils";
import { CustomVideo } from "@/components/courses/CustomVideo";
import {
  CourseOfferPopup,
  type CourseOffer,
} from "@/components/courses/CourseOfferPopup";

export interface MoreItem {
  title: string;
  image: string | null;
  priceLabel: string | null;
  href: string;
}

export interface PlayerLesson {
  id: string;
  title: string;
  video_url: string | null;
  content: string | null;
  duration_label: string | null;
  /** "video" | "text" | "pdf" | "image" — defaults to video. */
  lesson_type?: string;
  /** Source URL for pdf / image lessons (video uses video_url). */
  asset_url?: string | null;
  completed: boolean;
}
export interface PlayerModule {
  id: string;
  title: string;
  lessons: PlayerLesson[];
}

export function CoursePlayerClient({
  token,
  title,
  description,
  modules,
  preview = false,
  watermark,
  creatorName = null,
  moreItems = [],
  offer = null,
  courseKey = "",
}: {
  token: string;
  title: string;
  description: string | null;
  modules: PlayerModule[];
  /** Seller preview — no enrollment; hides progress/mark-complete. */
  preview?: boolean;
  /** Buyer identity (email) stamped over the video as an anti-piracy overlay. */
  watermark?: string | null;
  /** Seller's display name, for the "More from …" cross-sell heading. */
  creatorName?: string | null;
  /** Other products/courses from the same creator to promote on this page. */
  moreItems?: MoreItem[];
  /** Optional promotional offer popup (from the seller's storefront promo). */
  offer?: CourseOffer | null;
  /** Stable key for de-duping the offer popup per course (sessionStorage). */
  courseKey?: string;
}) {
  const flat = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const [done, setDone] = useState<Set<string>>(
    () => new Set(flat.filter((l) => l.completed).map((l) => l.id)),
  );
  const [activeId, setActiveId] = useState<string | null>(flat[0]?.id ?? null);
  const [marking, setMarking] = useState(false);

  // Fullscreen the player CONTAINER (not the bare <video>) so the watermark
  // overlay stays on screen in fullscreen. Native fullscreen is suppressed via
  // controlsList="nofullscreen" so buyers use this button instead.
  const playerRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void playerRef.current?.requestFullscreen().catch(() => {});
    }
  }

  // ── Single-screen enforcement ─────────────────────────────────────────
  // Heartbeat a per-tab session id; if another device owns the seat we block
  // playback (video unmounts) until the buyer takes over here.
  const sessionIdRef = useRef<string>("");
  const [blocked, setBlocked] = useState(false);
  const [takingOver, setTakingOver] = useState(false);

  async function beat(force = false): Promise<boolean | null> {
    try {
      const res = await fetch("/api/courses/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          t: token,
          session_id: sessionIdRef.current,
          force,
        }),
      });
      const b = (await res.json()) as { active?: boolean; control?: boolean };
      return b.control ? !!b.active : true;
    } catch {
      return null; // network blip — never block on it
    }
  }

  useEffect(() => {
    if (preview) return;
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now()}`;
    }
    let stop = false;
    // Newest device wins: claim the seat on mount (force) so THIS device always
    // plays and any other open device is kicked on its next heartbeat. Later
    // heartbeats don't force, so once another device opens and claims, this one
    // detects it lost the seat and blocks (until the user takes it back).
    let first = true;
    const tick = async () => {
      const active = await beat(first);
      first = false;
      if (!stop && active !== null) setBlocked(!active);
    };
    void tick();
    const id = setInterval(() => void tick(), 8_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, preview]);

  async function takeOver() {
    setTakingOver(true);
    const active = await beat(true);
    if (active) setBlocked(false);
    setTakingOver(false);
  }

  const active = flat.find((l) => l.id === activeId) ?? null;
  const lessonType = active?.lesson_type ?? "video";
  const assetUrl = active?.asset_url ?? null;
  const source =
    active && lessonType === "video"
      ? resolvePlaySource(active.video_url)
      : null;
  const total = flat.length;
  const completedCount = done.size;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  async function markComplete() {
    if (preview || !active || done.has(active.id)) return;
    setMarking(true);
    try {
      const res = await fetch("/api/courses/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: token, lesson_id: active.id }),
      });
      if (res.ok) {
        setDone((prev) => new Set(prev).add(active.id));
      }
    } catch {
      /* ignore — best-effort */
    } finally {
      setMarking(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {preview ? (
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Preview mode — this is how buyers see your course
          </span>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {pct}% · {completedCount}/{total} complete
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Player */}
        <div className="min-w-0">
          <div
            ref={playerRef}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "relative w-full overflow-hidden rounded-xl bg-black",
              isFs
                ? "flex h-screen items-center justify-center"
                : lessonType === "text" || lessonType === "pdf"
                  ? "h-[70vh]"
                  : "aspect-video",
            )}
          >
            {blocked ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
                <MonitorPlay className="h-9 w-9 text-white/60" />
                <div>
                  <p className="font-semibold">Playing on another device</p>
                  <p className="mt-1 text-sm text-white/60">
                    This course can be watched on one screen at a time. Close it
                    on the other device, or continue here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={takeOver}
                  disabled={takingOver}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {takingOver ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MonitorPlay className="h-4 w-4" />
                  )}
                  Watch here instead
                </button>
              </div>
            ) : lessonType === "text" ? (
              active?.content ? (
                <div className="h-full w-full overflow-y-auto bg-card px-5 py-6 text-foreground sm:px-8">
                  <p className="mx-auto max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">
                    {active.content}
                  </p>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  No text for this lesson.
                </div>
              )
            ) : lessonType === "pdf" ? (
              assetUrl ? (
                <iframe
                  src={assetUrl}
                  title={active?.title ?? "PDF"}
                  className="h-full w-full bg-white"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  No PDF for this lesson.
                </div>
              )
            ) : lessonType === "image" ? (
              assetUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assetUrl}
                  alt={active?.title ?? "Lesson image"}
                  onContextMenu={(e) => e.preventDefault()}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  No image for this lesson.
                </div>
              )
            ) : !source ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/70">
                <PlayCircle className="h-8 w-8" />
                <p className="text-sm">
                  {active ? "No video for this lesson." : "Select a lesson to begin."}
                </p>
              </div>
            ) : source.kind === "file" ? (
              <CustomVideo
                src={source.src}
                onToggleFullscreen={toggleFullscreen}
                isFs={isFs}
              />
            ) : source.kind === "signed" ? (
              <SignedVideo
                src={source.src}
                token={token}
                onToggleFullscreen={toggleFullscreen}
                isFs={isFs}
              />
            ) : (
              <iframe
                src={source.src}
                title={active?.title ?? "Lesson"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            )}
            {!blocked && source && watermark ? <Watermark label={watermark} /> : null}
            {!blocked && (lessonType === "image" || lessonType === "pdf") && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
                className="absolute bottom-2 right-2 z-10 rounded-md bg-black/55 p-1.5 text-white/90 backdrop-blur transition hover:bg-black/75"
              >
                {isFs ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {active && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sora text-lg font-semibold">{active.title}</h2>
                {!preview && (
                <button
                  onClick={markComplete}
                  disabled={marking || done.has(active.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                    done.has(active.id)
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-primary text-primary-foreground hover:opacity-90",
                  )}
                >
                  {marking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : done.has(active.id) ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  {done.has(active.id) ? "Completed" : "Mark complete"}
                </button>
                )}
              </div>
              {active.content && lessonType !== "text" && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {active.content}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Curriculum */}
        <aside className="space-y-4">
          {modules.map((m) => (
            <div key={m.id} className="card-surface overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
                {m.title}
              </div>
              <ul className="divide-y divide-border">
                {m.lessons.map((l) => {
                  const isDone = done.has(l.id);
                  const isActive = l.id === activeId;
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => setActiveId(l.id)}
                        className={cn(
                          "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-muted/40",
                          isActive && "bg-muted/60",
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{l.title}</span>
                        {l.duration_label && (
                          <span className="text-xs text-muted-foreground">
                            {l.duration_label}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {m.lessons.length === 0 && (
                  <li className="px-4 py-2.5 text-xs text-muted-foreground">
                    No lessons yet.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </aside>
      </div>

      {/* More from this creator — cross-sell the seller's other products */}
      {moreItems.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-sora text-lg font-semibold">
            {creatorName ? `More from ${creatorName}` : "More to explore"}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {moreItems.map((it, n) => (
              <a
                key={`${it.href}-${n}`}
                href={it.href}
                className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
              >
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.image}
                      alt={it.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <PlayCircle className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium">{it.title}</p>
                  {it.priceLabel && (
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {it.priceLabel}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {offer && courseKey && (
        <CourseOfferPopup offer={offer} courseKey={courseKey} />
      )}
    </main>
  );
}

/** Exchanges a private `cmedia:` source for a short-lived signed URL, then plays
 *  it. Re-fetches when the source changes (switching lessons). */
function SignedVideo({
  src,
  token,
  onToggleFullscreen,
  isFs,
}: {
  src: string;
  token: string;
  onToggleFullscreen?: () => void;
  isFs?: boolean;
}) {
  const [media, setMedia] = useState<{ url: string; kind: string } | null>(null);
  const [error, setError] = useState(false);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  // Resolve the cmedia: source → { url, kind }. kind 'hls' = encrypted stream.
  useEffect(() => {
    let cancelled = false;
    setMedia(null);
    setError(false);
    (async () => {
      try {
        const res = await fetch("/api/courses/video-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ src, t: token }),
        });
        const body = (await res.json()) as { url?: string; kind?: string };
        if (cancelled) return;
        if (res.ok && body.url) setMedia({ url: body.url, kind: body.kind ?? "file" });
        else setError(true);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, token]);

  // Attach the encrypted HLS stream to the CustomVideo's element: native HLS
  // (Safari) or hls.js. The key URL in the playlist is same-origin, so the
  // buyer token / seller cookie carries.
  useEffect(() => {
    if (!videoEl || !media || media.kind !== "hls") return;
    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = media.url;
      return;
    }
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    (async () => {
      try {
        const Hls = (await import("hls.js")).default;
        if (cancelled) return;
        if (Hls.isSupported()) {
          const inst = new Hls();
          inst.loadSource(media.url);
          inst.attachMedia(videoEl);
          hls = inst;
        } else {
          videoEl.src = media.url;
        }
      } catch {
        videoEl.src = media.url;
      }
    })();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [media, videoEl]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
        Couldn&apos;t load this video. Refresh to try again.
      </div>
    );
  }
  if (!media) {
    return (
      <div className="flex h-full w-full items-center justify-center text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  return (
    <CustomVideo
      key={media.url}
      src={media.kind === "hls" ? undefined : media.url}
      onVideoEl={setVideoEl}
      onToggleFullscreen={onToggleFullscreen}
      isFs={isFs}
    />
  );
}

/** Anti-piracy overlay. A FORENSIC watermark: the buyer's email is tiled faintly
 *  across the entire frame (rotated, so it can't be cropped out and any leaked
 *  screen-recording traces straight back to the buyer), plus a more visible
 *  drifting label. pointer-events-none so it never blocks the controls. */
function Watermark({ label }: { label: string }) {
  const positions = [
    "top-3 left-3",
    "top-3 right-3",
    "bottom-12 left-3",
    "bottom-12 right-3",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % positions.length), 7000);
    return () => clearInterval(id);
    // positions is a stable literal — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Enough tiles to cover the frame after rotate + scale.
  const tiles = Array.from({ length: 48 });
  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* Tiled forensic layer — faint, rotated, fills the frame edge-to-edge. */}
      <div className="absolute inset-0 flex rotate-[-24deg] scale-[1.6] flex-wrap content-around items-center justify-around gap-x-10 gap-y-12 opacity-[0.09]">
        {tiles.map((_, n) => (
          <span key={n} className="whitespace-nowrap text-[11px] font-semibold text-white">
            {label}
          </span>
        ))}
      </div>
      {/* Drifting visible label. */}
      <span
        className={cn(
          "absolute rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-white/40 transition-all duration-1000",
          positions[i],
        )}
      >
        {label}
      </span>
    </div>
  );
}
