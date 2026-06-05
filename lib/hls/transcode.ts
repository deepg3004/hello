// Server-only: transcode an uploaded video into AES-128-encrypted HLS using the
// system ffmpeg (no vendor, no license server). Returns the encryption key, the
// playlist (with a KEY-URI placeholder the playlist endpoint rewrites to the
// authorized key route), and the encrypted .ts segments. NEVER import from a
// client component.

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

/** Placeholder the stored playlist carries for the #EXT-X-KEY URI; the playlist
 *  delivery endpoint swaps it for the per-request authorized key URL. */
export const HLS_KEY_PLACEHOLDER = "INVOXAI_HLS_KEY_URI";

export interface HlsResult {
  keyHex: string; // 16-byte AES key, hex
  iv: string; // 16-byte IV, hex
  m3u8: string; // playlist; segments named seg_NNN.ts, key URI = placeholder
  segments: { name: string; bytes: Buffer }[];
}

export async function transcodeToHls(inputBytes: Buffer): Promise<HlsResult> {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "invox-hls-"));
  try {
    const input = path.join(work, "input.bin");
    await fs.writeFile(input, inputBytes);

    const key = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16).toString("hex");
    const keyFile = path.join(work, "enc.key");
    await fs.writeFile(keyFile, key);
    // keyinfo: line1 = KEY URI embedded in the playlist; line2 = local key file
    // ffmpeg reads to encrypt; line3 = IV.
    const keyInfo = path.join(work, "enc.keyinfo");
    await fs.writeFile(keyInfo, `${HLS_KEY_PLACEHOLDER}\n${keyFile}\n${iv}\n`);

    const m3u8Path = path.join(work, "out.m3u8");
    await runFfmpeg([
      "-i", input,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-b:a", "128k",
      "-pix_fmt", "yuv420p",
      "-hls_time", "6",
      "-hls_key_info_file", keyInfo,
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(work, "seg_%03d.ts"),
      m3u8Path,
      "-y",
    ]);

    const m3u8 = await fs.readFile(m3u8Path, "utf8");
    const files = (await fs.readdir(work)).filter((f) => /^seg_\d+\.ts$/.test(f)).sort();
    const segments: { name: string; bytes: Buffer }[] = [];
    for (const f of files) {
      segments.push({ name: f, bytes: await fs.readFile(path.join(work, f)) });
    }
    if (segments.length === 0) throw new Error("ffmpeg produced no segments");

    return { keyHex: key.toString("hex"), iv, m3u8, segments };
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 4000) err = err.slice(-4000);
    });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-600)}`)),
    );
  });
}
