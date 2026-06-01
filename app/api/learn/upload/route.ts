// POST /api/learn/upload  (admin only)
//
// Uploads an image (thumbnail / hero) or a video (MP4/WebM/MOV) to the public
// `learn-media` bucket and returns its public URL. Used by the admin Learn CMS.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "learn-media";

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
  // Gate on an admin session.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const path = `${isVideo ? "video" : "image"}/${nanoid(12)}.${ext}`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, kind: isVideo ? "video" : "image" });
}
