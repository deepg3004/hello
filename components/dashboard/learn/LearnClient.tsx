"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Play } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { deriveThumb, resolvePlaySource } from "@/lib/learn/video";

export interface LearnVideo {
  id: string;
  section: "featured" | "use_invoxai" | "niche";
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_label: string | null;
  badge_label: string | null;
  cta_label: string | null;
}

interface ResourcesContent {
  title: string;
  bullets: string[];
  ctaLabel: string;
  ctaUrl: string;
}

interface Props {
  featured: LearnVideo | null;
  useInvoxai: LearnVideo[];
  niche: LearnVideo[];
  resources: ResourcesContent;
}

export function LearnClient({ featured, useInvoxai, niche, resources }: Props) {
  const [playing, setPlaying] = useState<LearnVideo | null>(null);

  return (
    <div className="mx-auto max-w-[1200px] space-y-10">
      {/* ── SECTION B: ESSENTIALS ─────────────────────────────────────── */}
      <section>
        <SectionHeading emoji="👇">Essentials — start here</SectionHeading>
        <div className="flex flex-col gap-5 lg:flex-row">
          {featured ? (
            <FeaturedCard video={featured} onPlay={() => setPlaying(featured)} />
          ) : (
            <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground lg:w-[70%]">
              No featured masterclass yet.
            </div>
          )}
          <ResourceCard resources={resources} />
        </div>
      </section>

      {/* ── SECTION C ─────────────────────────────────────────────────── */}
      {useInvoxai.length > 0 && (
        <Carousel
          title={<SectionHeading emoji="🚀">Learn how to use invoxai</SectionHeading>}
          videos={useInvoxai}
          cardWidth={250}
          onPlay={setPlaying}
        />
      )}

      {/* ── SECTION D ─────────────────────────────────────────────────── */}
      {niche.length > 0 && (
        <Carousel
          title={<SectionHeading emoji="💸">Earning money in your niche</SectionHeading>}
          videos={niche}
          cardWidth={320}
          onPlay={setPlaying}
        />
      )}

      <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}

// ── Shared section heading ──────────────────────────────────────────────────
function SectionHeading({
  emoji,
  children,
}: {
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 font-sora text-[19px] font-bold tracking-tight text-foreground">
      {emoji && <span aria-hidden>{emoji}</span>}
      {children}
    </h2>
  );
}

// ── Featured masterclass card ───────────────────────────────────────────────
function FeaturedCard({ video, onPlay }: { video: LearnVideo; onPlay: () => void }) {
  const thumb = deriveThumb(video.video_url, video.thumbnail_url);
  return (
    <div className="group/feat overflow-hidden rounded-2xl bg-[#2B2718] shadow-card transition-shadow duration-200 hover:shadow-card-md lg:min-h-[330px] lg:w-[70%]">
      <div className="flex h-full flex-col sm:flex-row">
        {/* Thumbnail half */}
        <button
          type="button"
          onClick={onPlay}
          className="group relative h-[210px] w-full overflow-hidden sm:h-auto sm:w-1/2"
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#3a3320] to-[#211d12]" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/0">
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white/25 backdrop-blur-sm ring-1 ring-white/30 transition-transform group-hover:scale-110">
              <Play className="h-5 w-5 translate-x-[1px] fill-white text-white" />
            </span>
          </span>
        </button>

        {/* Text half */}
        <div className="flex flex-1 flex-col justify-center gap-3 p-6 text-white sm:w-1/2 sm:p-7">
          {video.badge_label && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E53935] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-card" />
              {video.badge_label}
            </span>
          )}
          <h3 className="font-sora text-[22px] font-bold leading-snug">{video.title}</h3>
          {video.description && (
            <p className="line-clamp-2 text-[13.5px] leading-relaxed text-white/70">
              {video.description}
            </p>
          )}
          {video.duration_label && (
            <p className="inline-flex items-center gap-1.5 text-[12.5px] text-white/55">
              <Play className="h-3 w-3 fill-white/55 text-white/55" />
              {video.duration_label}
            </p>
          )}
          <button
            type="button"
            onClick={onPlay}
            className="mt-1 w-fit rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1a1a] shadow-sm transition hover:bg-white/90 active:scale-[0.98]"
          >
            {video.cta_label || "Start watching"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Two-tone resources card ─────────────────────────────────────────────────
function ResourceCard({ resources }: { resources: ResourcesContent }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl shadow-card transition-shadow duration-200 hover:shadow-card-md lg:min-h-[330px]">
      {/* Top — amber with book line-art */}
      <div className="relative flex h-[120px] items-center justify-center overflow-hidden bg-[#F5A623] lg:h-[42%]">
        <BookOpen className="h-14 w-14 text-white/90" strokeWidth={1.25} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
      </div>
      {/* Bottom — dark */}
      <div className="flex flex-1 flex-col gap-3 bg-[#3B2E00] p-5 text-white">
        <h3 className="font-sora text-[16px] font-bold">{resources.title}</h3>
        <ul className="flex-1 space-y-1.5 text-[13px] text-white/85">
          {resources.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-[#F5A623]">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {resources.ctaUrl && (
          <a
            href={resources.ctaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#1a1a1a] transition hover:bg-white/90 active:scale-[0.98]"
          >
            {resources.ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Horizontal carousel ─────────────────────────────────────────────────────
function Carousel({
  title,
  videos,
  cardWidth,
  onPlay,
}: {
  title: React.ReactNode;
  videos: LearnVideo[];
  cardWidth: number;
  onPlay: (v: LearnVideo) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function update() {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos.length]);

  function scrollBy(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        {title}
        <div className="flex items-center gap-2">
          <ArrowBtn label="Scroll left" disabled={!canLeft} onClick={() => scrollBy(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </ArrowBtn>
          <ArrowBtn label="Scroll right" disabled={!canRight} onClick={() => scrollBy(1)}>
            <ChevronRight className="h-4 w-4" />
          </ArrowBtn>
        </div>
      </div>

      <div className="relative">
        {/* Edge fade masks — only when there's more to scroll. */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-card to-transparent transition-opacity duration-200 ${canLeft ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card to-transparent transition-opacity duration-200 ${canRight ? "opacity-100" : "opacity-0"}`}
        />
        <div
          ref={scroller}
          onScroll={update}
          className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} width={cardWidth} onPlay={() => onPlay(v)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrowBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-muted"
    >
      {children}
    </button>
  );
}

function VideoCard({
  video,
  width,
  onPlay,
}: {
  video: LearnVideo;
  width: number;
  onPlay: () => void;
}) {
  const thumb = deriveThumb(video.video_url, video.thumbnail_url);
  return (
    <button
      type="button"
      onClick={onPlay}
      style={{ width }}
      className="group shrink-0 snap-start text-left"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 ring-1 ring-black/5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-card-md dark:from-slate-700 dark:to-slate-800">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/5 transition-colors group-hover:bg-black/0">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform group-hover:scale-110">
            <Play className="h-4 w-4 translate-x-[1px] fill-[#111] text-[#111]" />
          </span>
        </span>
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
        {video.title}
      </h3>
      {video.description && (
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
          {video.description}
        </p>
      )}
    </button>
  );
}

// ── Video modal ─────────────────────────────────────────────────────────────
function VideoModal({ video, onClose }: { video: LearnVideo | null; onClose: () => void }) {
  const source = video ? resolvePlaySource(video.video_url) : null;
  return (
    <Dialog open={!!video} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogTitle className="sr-only">{video?.title ?? "Video"}</DialogTitle>
        <div className="aspect-video w-full bg-black">
          {!source ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-white/80">
              <Play className="h-8 w-8" />
              <p className="text-sm">This video isn&apos;t available yet.</p>
            </div>
          ) : source.kind === "file" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={source.src} controls autoPlay className="h-full w-full" />
          ) : (
            <iframe
              src={source.src}
              title={video?.title ?? "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          )}
        </div>
        {video?.title && (
          <div className="px-5 py-3">
            <p className="text-sm font-semibold text-foreground">{video.title}</p>
            {video.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{video.description}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
