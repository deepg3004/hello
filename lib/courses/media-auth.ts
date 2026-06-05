// Authorization for private course-media (signed URLs + HLS playlist/key).
// Mirrors /api/courses/video-url: allow EITHER a valid course-access token (a
// paid buyer) OR the owning seller / a team member with courses.view (preview).
// Server-only.

import { getActorContext } from "@/lib/account-context";
import { verifyCourseToken } from "@/lib/course-token";

export async function authorizeCourseMedia(
  rawPath: string,
  token: string | null | undefined,
): Promise<boolean> {
  // Path shape: course/<ownerId>/video/<file>. Reject traversal / odd shapes.
  const parts = rawPath.split("/");
  if (parts[0] !== "course" || parts.length < 4 || rawPath.includes("..")) {
    return false;
  }
  const ownerId = parts[1];

  if (token && verifyCourseToken(token)) return true;

  const ctx = await getActorContext();
  if (ctx && ctx.ownerId === ownerId && ctx.can("courses.view")) return true;

  return false;
}
