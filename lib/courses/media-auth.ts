// Authorization for private course-media (signed URLs + HLS playlist/key).
// Allow EITHER a course token whose COURSE actually contains this video (a paid
// buyer of THAT course — not any course) OR the owning seller / a team member
// with courses.view. Server-only.
//
// SECURITY: the token must be scoped to the requested video. A bare
// verifyCourseToken() is NOT enough — any valid token would otherwise unlock any
// seller's key. We bind token.course_id → the lesson that stores this video.

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";
import { verifyCourseToken, verifyPreviewToken } from "@/lib/course-token";
import { CMEDIA_PREFIX } from "@/lib/learn/video";

/** Does `courseId` (owned by `ownerId`) contain a lesson whose video is rawPath? */
async function courseOwnsVideo(
  admin: ReturnType<typeof createAdminClient>,
  rawPath: string,
  courseId: string,
  ownerId: string,
): Promise<boolean> {
  // The course must belong to the path's seller.
  const { data: course } = await admin
    .from("courses")
    .select("id, seller_user_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.seller_user_id !== ownerId) return false;

  // A lesson in THIS course must store this exact video.
  const { data: lessons } = await admin
    .from("course_lessons")
    .select("module_id")
    .eq("video_url", `${CMEDIA_PREFIX}${rawPath}`);
  const moduleIds = Array.from(new Set((lessons ?? []).map((l) => l.module_id)));
  if (moduleIds.length === 0) return false;

  const { data: modules } = await admin
    .from("course_modules")
    .select("id")
    .eq("course_id", courseId)
    .in("id", moduleIds);
  return (modules ?? []).length > 0;
}

/** Like courseOwnsVideo, but the lesson must ALSO be a free preview. */
async function courseOwnsPreviewVideo(
  admin: ReturnType<typeof createAdminClient>,
  rawPath: string,
  courseId: string,
  ownerId: string,
): Promise<boolean> {
  const { data: course } = await admin
    .from("courses")
    .select("id, seller_user_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.seller_user_id !== ownerId) return false;

  // A PREVIEW lesson in this course must store this exact video.
  const { data: lessons } = await admin
    .from("course_lessons")
    .select("module_id, is_preview")
    .eq("video_url", `${CMEDIA_PREFIX}${rawPath}`)
    .eq("is_preview", true);
  const moduleIds = Array.from(new Set((lessons ?? []).map((l) => l.module_id)));
  if (moduleIds.length === 0) return false;

  const { data: modules } = await admin
    .from("course_modules")
    .select("id")
    .eq("course_id", courseId)
    .in("id", moduleIds);
  return (modules ?? []).length > 0;
}

export async function authorizeCourseMedia(
  rawPath: string,
  token: string | null | undefined,
): Promise<boolean> {
  // Strict path shape: course/<ownerId>/video/<file>.
  const parts = rawPath.split("/");
  if (
    parts.length !== 4 ||
    parts[0] !== "course" ||
    parts[2] !== "video" ||
    !parts[1] ||
    !parts[3] ||
    rawPath.includes("..")
  ) {
    return false;
  }
  const ownerId = parts[1];

  // 1. Paid buyer — but only of the course that actually contains this video.
  if (token) {
    const payload = verifyCourseToken(token);
    if (payload?.course_id) {
      const admin = createAdminClient();
      if (await courseOwnsVideo(admin, rawPath, payload.course_id, ownerId)) {
        return true;
      }
    }
    // 1b. Free-preview token — unlocks ONLY this course's is_preview lessons.
    const preview = verifyPreviewToken(token);
    if (preview?.course_id) {
      const admin = createAdminClient();
      if (await courseOwnsPreviewVideo(admin, rawPath, preview.course_id, ownerId)) {
        return true;
      }
    }
  }

  // 2. Owning seller / team member previewing in the dashboard.
  const ctx = await getActorContext();
  if (ctx && ctx.ownerId === ownerId && ctx.can("courses.view")) return true;

  return false;
}
