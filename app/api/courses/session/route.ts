// POST /api/courses/session
//
// Single-screen enforcement for course playback. The player heartbeats here
// with its course token + a per-tab session id; the server claims/refreshes
// the "seat" (keyed by the order) and replies whether THIS session currently
// owns it. A second device gets { active: false } and is blocked until it
// takes over (force: true).
//
// Body: { t: courseToken, session_id: string, force?: boolean }
// Reply: { ok: true, active: boolean, control: boolean }
//   control=false → no single-screen control applies (preview / invalid token).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCourseToken } from "@/lib/course-token";

export const dynamic = "force-dynamic";

// A seat is considered free if its last heartbeat is older than this. Must be
// comfortably larger than the client heartbeat interval (8s) so a live tab keeps
// it, but small enough that a blocked device recovers quickly once the other
// device closes.
const STALE_SECONDS = 25;

export async function POST(request: Request) {
  let body: { t?: string; session_id?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const t = body.t?.trim();
  const sessionId = body.session_id?.trim();
  if (!t || !sessionId) {
    return NextResponse.json(
      { error: "t + session_id required" },
      { status: 400 },
    );
  }

  // Preview / invalid tokens have no per-purchase seat → no control.
  const payload = verifyCourseToken(t);
  if (!payload) {
    return NextResponse.json({ ok: true, active: true, control: false });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_course_session", {
    p_subject: payload.order_id,
    p_course_id: payload.course_id,
    p_session: sessionId,
    p_stale_seconds: STALE_SECONDS,
    p_force: !!body.force,
  });

  // Fail OPEN: a DB hiccup must never lock a paying buyer out of their course.
  if (error) {
    return NextResponse.json({ ok: true, active: true, control: false });
  }

  const owner = data as string;
  return NextResponse.json({
    ok: true,
    active: owner === sessionId,
    control: true,
  });
}
