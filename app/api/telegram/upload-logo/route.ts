import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "channel-logos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  const actor = await requireActor("telegram.manage");
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
    return NextResponse.json({ error: "Use a PNG, JPG, WebP or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 2 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.ownerId}/${nanoid(12)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
