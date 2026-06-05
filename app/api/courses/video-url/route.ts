// POST /api/courses/video-url
//
// Body: { src: "cmedia:course/<sellerId>/video/<id>.mp4", t?: <courseToken> }
//
// Exchanges a private course-media sentinel for a short-lived signed URL.
// Authorised by EITHER a valid course-access token (a paid buyer) OR the
// logged-in seller who owns the object (path's <sellerId> === user.id) for the
// in-dashboard preview. Returns { url } valid for ~2h.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCourseMedia } from "@/lib/courses/media-auth";
import { CMEDIA_PREFIX } from "@/lib/learn/video";

const VIDEO_BUCKET = "course-media";
const SIGN_TTL_SECONDS = 2 * 60 * 60;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { src?: string; t?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const src = body.src?.trim();
  if (!src || !src.startsWith(CMEDIA_PREFIX)) {
    return NextResponse.json({ error: "Bad source" }, { status: 400 });
  }
  const path = src.slice(CMEDIA_PREFIX.length);

  // Authorise: a course token scoped to THIS video, or the owning seller. The
  // helper binds token.course_id → the lesson storing this video so one course's
  // token can't unlock another seller's media.
  if (!(await authorizeCourseMedia(path, body.t))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Prefer the AES-128 HLS stream once transcoded — segments are encrypted, and
  // the key is served only via the authorized key route.
  const { data: hls } = await admin
    .from("hls_assets")
    .select("status")
    .eq("raw_path", path)
    .maybeSingle();
  if (hls?.status === "ready") {
    const q = new URLSearchParams({ path });
    if (body.t) q.set("t", body.t);
    return NextResponse.json({
      url: `/api/courses/hls/playlist?${q.toString()}`,
      kind: "hls",
    });
  }

  const { data, error } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl, kind: "file" });
}
