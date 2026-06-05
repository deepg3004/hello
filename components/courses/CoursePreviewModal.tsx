"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolvePlaySource } from "@/lib/learn/video";

export interface PreviewLesson {
  id: string;
  title: string;
  video_url: string | null;
  duration_label: string | null;
}

/** Plays a course's free-preview lessons before purchase, using a preview token
 *  that only authorises is_preview media. */
export function CoursePreviewModal({
  open,
  onOpenChange,
  lessons,
  previewToken,
  initialId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lessons: PreviewLesson[];
  previewToken: string;
  initialId?: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(initialId ?? lessons[0]?.id ?? null);
  useEffect(() => {
    if (open && initialId) setActiveId(initialId);
  }, [open, initialId]);

  const active = lessons.find((l) => l.id === activeId) ?? lessons[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Course preview</DialogTitle>
        </DialogHeader>
        <div className="grid gap-0 sm:grid-cols-[1fr_220px]">
          <div className="aspect-video w-full bg-black">
            {active ? (
              <PreviewPlayer key={active.id} videoUrl={active.video_url} token={previewToken} />
            ) : (
              <div className="flex h-full items-center justify-center text-white/50">No preview available</div>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto border-l p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Free preview lessons
            </p>
            {lessons.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className={
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition " +
                  (l.id === active?.id ? "bg-primary/10 text-primary" : "hover:bg-muted")
                }
              >
                <PlayCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{l.title}</span>
                {l.duration_label && <span className="text-xs text-muted-foreground">{l.duration_label}</span>}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPlayer({ videoUrl, token }: { videoUrl: string | null; token: string }) {
  const source = resolvePlaySource(videoUrl);
  const [media, setMedia] = useState<{ url: string; kind: string } | null>(null);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // For private (signed) sources, exchange for a signed/HLS URL via the preview token.
  useEffect(() => {
    if (!source || source.kind !== "signed") return;
    let cancelled = false;
    setMedia(null);
    setError(false);
    (async () => {
      try {
        const res = await fetch("/api/courses/video-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ src: source.src, t: token }),
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
  }, [source, token]);

  // Attach HLS when needed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media || media.kind !== "hls") return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = media.url;
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
          inst.attachMedia(video);
          hls = inst;
        } else {
          video.src = media.url;
        }
      } catch {
        video.src = media.url;
      }
    })();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [media]);

  if (!source) {
    return <div className="flex h-full items-center justify-center text-white/50">No video</div>;
  }
  if (source.kind === "youtube" || source.kind === "vimeo" || source.kind === "iframe") {
    return (
      <iframe
        src={source.src}
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (source.kind === "file") {
    return <video src={source.src} controls controlsList="nodownload" className="h-full w-full" />;
  }
  // signed
  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-white/60">Couldn’t load preview.</div>;
  }
  if (!media) {
    return (
      <div className="flex h-full items-center justify-center text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  return (
    <video
      ref={videoRef}
      src={media.kind === "hls" ? undefined : media.url}
      controls
      controlsList="nodownload"
      className="h-full w-full"
    />
  );
}
