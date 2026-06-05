// Server-only: the actual HLS transcode work — download the raw upload, encrypt
// it to HLS via ffmpeg, upload the playlist + segments back to the private
// bucket, and record the (encrypted) key in hls_assets. Shared by the BullMQ
// worker and the inline (no-Redis) fallback.

import { createAdminClient } from "@/lib/supabase/admin";
import { encryptGatewayKey } from "@/lib/gateway-crypto";
import { transcodeToHls } from "@/lib/hls/transcode";

const VIDEO_BUCKET = "course-media";

/** Transcode the raw video at `rawPath` (course-media path, no cmedia: prefix)
 *  into AES-128 HLS and store it. Idempotent: skips if already ready. */
export async function processHlsForPath(rawPath: string): Promise<void> {
  const admin = createAdminClient();

  // Skip if already done.
  const { data: existing } = await admin
    .from("hls_assets")
    .select("status")
    .eq("raw_path", rawPath)
    .maybeSingle();
  if (existing?.status === "ready") return;

  try {
    // 1. Download the raw upload.
    const { data: blob, error: dlErr } = await admin.storage
      .from(VIDEO_BUCKET)
      .download(rawPath);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");
    const inputBytes = Buffer.from(await blob.arrayBuffer());

    // 2. Transcode → encrypted HLS.
    const result = await transcodeToHls(inputBytes);

    // 3. Upload playlist + segments under <rawDir>/hls/<rawBase>/.
    const dir = `${rawPath.replace(/\.[^./]+$/, "")}/hls`;
    const uploads: Promise<unknown>[] = [
      admin.storage.from(VIDEO_BUCKET).upload(`${dir}/out.m3u8`, Buffer.from(result.m3u8), {
        contentType: "application/vnd.apple.mpegurl",
        upsert: true,
      }),
    ];
    for (const seg of result.segments) {
      uploads.push(
        admin.storage.from(VIDEO_BUCKET).upload(`${dir}/${seg.name}`, seg.bytes, {
          contentType: "video/mp2t",
          upsert: true,
        }),
      );
    }
    await Promise.all(uploads);

    // 4. Record (key encrypted at rest).
    await admin
      .from("hls_assets")
      .update({
        hls_dir: dir,
        key_enc: encryptGatewayKey(result.keyHex),
        iv: result.iv,
        seg_count: result.segments.length,
        status: "ready",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("raw_path", rawPath);

    // 5. Drop the raw (unencrypted) upload now that the encrypted HLS is the
    //    source of truth — saves storage + removes the last plaintext copy.
    //    Best-effort; the lesson keeps the cmedia: path as the hls_assets key.
    const { error: rmErr } = await admin.storage.from(VIDEO_BUCKET).remove([rawPath]);
    if (rmErr) console.error("[hls] raw cleanup failed (non-fatal)", rawPath, rmErr.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hls] transcode failed", rawPath, msg);
    await admin
      .from("hls_assets")
      .update({ status: "failed", error: msg.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("raw_path", rawPath);
  }
}
