// POST /api/courses/upload  (any signed-in seller)
//
// Uploads a lesson video (MP4/WebM/MOV) or an image (thumbnail) to the public
// `learn-media` bucket under course/… and returns its public URL. Mirrors
// /api/learn/upload but gated on a logged-in seller rather than an admin.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Images (thumbnails) stay in the public bucket so <img> works everywhere.
// Course VIDEOS go to a private bucket and play only via signed URLs (Session 9
// — Course DRM). The stored video_url uses a `cmedia:` sentinel so the player
// knows to exchange it for a short-lived signed URL.
const BUCKET = "learn-media";
const VIDEO_BUCKET = "course-media";
const CMEDIA_PREFIX = "cmedia:";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const MAX_IMAGE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO = 100 * 1024 * 1024; // 100 MB

export async function POST(req: Request) {
  const actor = await requireActor("courses.manage");
  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: 403 });
  }
  const { ctx } = actor;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Use a PNG/JPG/WebP/GIF image or an MP4/WebM/MOV video." },
      { status: 400 },
    );
  }
  const isVideo = file.type.startsWith("video/");
  if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
    return NextResponse.json(
      { error: isVideo ? "Video must be under 100 MB." : "Image must be under 5 MB." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `course/${ctx.ownerId}/${isVideo ? "video" : "image"}/${nanoid(12)}.${ext}`;
  const bucket = isVideo ? VIDEO_BUCKET : BUCKET;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isVideo) {
    // Kick off AES-128 HLS transcoding in the background (Session 9 DRM). The
    // player prefers the encrypted HLS stream once ready and falls back to the
    // raw signed URL while it processes. Best-effort — never blocks the upload.
    try {
      await admin
        .from("hls_assets")
        .upsert({ raw_path: path, status: "processing" }, { onConflict: "raw_path" });
      const { enqueueHlsJob } = await import("@/lib/queues/hls");
      await enqueueHlsJob(path);
    } catch (e) {
      console.error("[courses/upload] hls enqueue failed", e);
    }
    // Private bucket — store a sentinel, NOT a public URL. The player exchanges
    // it for a short-lived signed URL via /api/courses/video-url.
    return NextResponse.json({
      ok: true,
      url: `${CMEDIA_PREFIX}${path}`,
      kind: "video",
    });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    url: data.publicUrl,
    kind: "image",
  });
}
