// POST /api/courses/progress  { t: <course token>, lesson_id }
// Marks a lesson complete for the token's enrollment. No login — the signed
// course token authorises the buyer.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCourseToken } from "@/lib/course-token";

export async function POST(request: Request) {
  let body: { t?: string; lesson_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body.t ? verifyCourseToken(body.t) : null;
  if (!payload || !body.lesson_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Resolve the enrollment from the token.
  const { data: enrollment } = await admin
    .from("course_enrollments")
    .select("id, course_id")
    .eq("course_id", payload.course_id)
    .eq("order_id", payload.order_id)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ error: "No enrollment" }, { status: 403 });
  }

  // Confirm the lesson belongs to this course (lesson → module → course).
  const { data: lesson } = await admin
    .from("course_lessons")
    .select("id, course_modules(course_id)")
    .eq("id", body.lesson_id)
    .maybeSingle();
  const rel = (lesson as { course_modules?: { course_id?: string } | { course_id?: string }[] } | null)
    ?.course_modules;
  const lessonCourseId = (Array.isArray(rel) ? rel[0] : rel)?.course_id;
  if (!lesson || lessonCourseId !== enrollment.course_id) {
    return NextResponse.json({ error: "Bad lesson" }, { status: 400 });
  }

  const { error } = await admin
    .from("lesson_progress")
    .upsert(
      { enrollment_id: enrollment.id, lesson_id: body.lesson_id },
      { onConflict: "enrollment_id,lesson_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
