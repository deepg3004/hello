// POST /api/uploads/product-file — seller uploads a downloadable digital file
// for a store product. Stored in the PRIVATE `product-files` bucket under
// <ownerId>/; delivered later via short-lived signed URLs to paying buyers
// only. Returns { path, name } — the caller stores `pfile:<path>` as file_url.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-files";
const MAX = 50 * 1024 * 1024; // 50 MB
// Block types that could be served as active content; everything else (pdf,
// zip, epub, mp3/mp4, images, docs, etc.) is allowed.
const BLOCKED_EXT = new Set(["html", "htm", "svg", "xhtml", "js", "mjs"]);

function safeExt(name: string): string {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name.trim());
  return m ? m[1].toLowerCase() : "bin";
}

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
  if (file.size > MAX) {
    return NextResponse.json({ error: "File must be under 50 MB." }, { status: 400 });
  }

  const ext = safeExt(file.name || "file");
  if (BLOCKED_EXT.has(ext)) {
    return NextResponse.json({ error: "That file type isn't allowed." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.ownerId}/${nanoid(16)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, name: (file.name || "download").slice(0, 200) });
}
