// GET /api/courses/hls/key?path=<rawPath>&t=<courseToken>
//
// Hands the AES-128 decryption key to an AUTHORIZED viewer (paid buyer token OR
// owning seller). This is the protected secret of the HLS DRM — without it the
// encrypted segments are useless. hls.js fetches this from the playlist's
// #EXT-X-KEY URI.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCourseMedia } from "@/lib/courses/media-auth";
import { decryptGatewayKey } from "@/lib/gateway-crypto";

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
    .select("key_enc, status")
    .eq("raw_path", path)
    .maybeSingle();
  if (!asset || asset.status !== "ready" || !asset.key_enc) {
    return NextResponse.json({ error: "Not ready" }, { status: 404 });
  }

  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(decryptGatewayKey(asset.key_enc as string), "hex");
  } catch {
    return NextResponse.json({ error: "Key error" }, { status: 500 });
  }
  if (keyBytes.length !== 16) {
    return NextResponse.json({ error: "Key error" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(keyBytes), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
    },
  });
}
