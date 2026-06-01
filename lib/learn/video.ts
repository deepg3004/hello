// Pure helpers (client + server safe) for resolving a video URL into something
// playable, and for deriving a thumbnail. Supports YouTube, Vimeo, and direct
// video files (uploaded MP4/WebM/MOV).

export type PlayKind = "youtube" | "vimeo" | "file" | "iframe";

export interface PlaySource {
  kind: PlayKind;
  /** iframe src (youtube/vimeo/iframe) or the file URL (file). */
  src: string;
}

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m?.[1] ?? null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  return m?.[1] ?? null;
}

export function isFileVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);
}

/** Resolve a stored video_url to a playable source. Returns null if empty. */
export function resolvePlaySource(url: string | null | undefined): PlaySource | null {
  if (!url) return null;
  const yt = youtubeId(url);
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0` };
  const vm = vimeoId(url);
  if (vm) return { kind: "vimeo", src: `https://player.vimeo.com/video/${vm}?autoplay=1` };
  if (isFileVideo(url)) return { kind: "file", src: url };
  return { kind: "iframe", src: url };
}

/**
 * Best thumbnail for a card: an explicit thumbnail_url wins; otherwise fall
 * back to YouTube's auto thumbnail when the video is a YouTube link. Returns
 * null when nothing is available (caller renders a gradient placeholder).
 */
export function deriveThumb(
  videoUrl: string | null | undefined,
  thumbnailUrl: string | null | undefined,
): string | null {
  if (thumbnailUrl) return thumbnailUrl;
  const yt = videoUrl ? youtubeId(videoUrl) : null;
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  return null;
}
