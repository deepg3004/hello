// POST /api/uploads/image — general seller image upload (logos, favicons,
// product photos, banners). Any signed-in seller may upload. Stores in the
// public `learn-media` bucket under uploads/<ownerId>/ and returns a public URL.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "learn-media";
// NOTE: SVG is intentionally NOT allowed — this bucket is PUBLIC and SVGs can
// carry inline <script>, which would be stored XSS when opened on the seller's
// storefront origin. (The product-file upload route blocks it for the same
// reason.) ICO/PNG/JPG/WebP/GIF are raster/binary and safe.
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
const MAX = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  const ctx = await getActorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Use a PNG, JPG, WebP, GIF or ICO image." }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `uploads/${ctx.ownerId}/${nanoid(14)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
