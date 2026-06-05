// GET /api/courses/hls/playlist?path=<rawPath>&t=<courseToken>
//
// Serves the AES-128 HLS playlist for a transcoded course video. Authorized like
// the signed-URL route (paid buyer token OR owning seller). Rewrites the stored
// playlist on the fly: segment names → short-lived signed bucket URLs, and the
// #EXT-X-KEY URI → our authorized key route. The segments are encrypted, so the
// only real secret is the key — which only the key route hands out.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCourseMedia } from "@/lib/courses/media-auth";
import { HLS_KEY_PLACEHOLDER } from "@/lib/hls/transcode";

const VIDEO_BUCKET = "course-media";
const SEG_TTL = 2 * 60 * 60;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  const token = url.searchParams.get("t");

  if (!(await authorizeCourseMedia(path, token))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("hls_assets")
    .select("hls_dir, status")
    .eq("raw_path", path)
    .maybeSingle();
  if (!asset || asset.status !== "ready" || !asset.hls_dir) {
    return NextResponse.json({ error: "Not ready" }, { status: 404 });
  }
  const dir = asset.hls_dir as string;

  const { data: m3u8Blob, error: dlErr } = await admin.storage
    .from(VIDEO_BUCKET)
    .download(`${dir}/out.m3u8`);
  if (dlErr || !m3u8Blob) {
    return NextResponse.json({ error: "Playlist missing" }, { status: 404 });
  }
  let m3u8 = await m3u8Blob.text();

  // Collect segment names + sign them in one batch.
  const segNames = Array.from(m3u8.matchAll(/^(seg_\d+\.ts)$/gm)).map((m) => m[1]);
  const { data: signed } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrls(segNames.map((n) => `${dir}/${n}`), SEG_TTL);
  const urlByName = new Map<string, string>();
  (signed ?? []).forEach((s, i) => {
    if (s.signedUrl) urlByName.set(segNames[i]!, s.signedUrl);
  });

  // Rewrite segment names → signed URLs.
  m3u8 = m3u8.replace(/^(seg_\d+\.ts)$/gm, (_, name: string) => urlByName.get(name) ?? name);

  // Rewrite the key URI → authorized key route.
  const keyUrl = `/api/courses/hls/key?path=${encodeURIComponent(path)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
  m3u8 = m3u8.replace(HLS_KEY_PLACEHOLDER, keyUrl);

  return new NextResponse(m3u8, {
    status: 200,
    headers: {
      "content-type": "application/vnd.apple.mpegurl",
      "cache-control": "no-store",
    },
  });
}
