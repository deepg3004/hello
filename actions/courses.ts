"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Result {
  ok: boolean;
  message?: string;
  id?: string;
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Returns the course id if the user owns the course/module/lesson, else null. */
async function ownedCourseId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  ref: { courseId?: string; moduleId?: string; lessonId?: string },
): Promise<string | null> {
  let courseId = ref.courseId ?? null;
  if (!courseId && ref.moduleId) {
    const { data } = await admin
      .from("course_modules")
      .select("course_id")
      .eq("id", ref.moduleId)
      .single();
    courseId = data?.course_id ?? null;
  }
  if (!courseId && ref.lessonId) {
    const { data } = await admin
      .from("course_lessons")
      .select("module_id, course_modules(course_id)")
      .eq("id", ref.lessonId)
      .single();
    const rel = (data as { course_modules?: { course_id?: string } | { course_id?: string }[] } | null)
      ?.course_modules;
    const m = Array.isArray(rel) ? rel[0] : rel;
    courseId = m?.course_id ?? null;
  }
  if (!courseId) return null;
  const { data: course } = await admin
    .from("courses")
    .select("id, seller_user_id")
    .eq("id", courseId)
    .single();
  return course && course.seller_user_id === userId ? course.id : null;
}

async function nextSort(
  admin: ReturnType<typeof createAdminClient>,
  table: "course_modules" | "course_lessons",
  col: "course_id" | "module_id",
  parentId: string,
): Promise<number> {
  const { data } = await admin
    .from(table)
    .select("sort_order")
    .eq(col, parentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function createCourseAction(input: { title: string }): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const title = input.title?.trim();
  if (!title) return { ok: false, message: "Title is required" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("courses")
    .insert({ seller_user_id: userId, title })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Failed" };
  revalidatePath("/dashboard/courses");
  return { ok: true, id: data.id };
}

export async function updateCourseAction(input: {
  id: string;
  title?: string;
  description?: string | null;
  thumbnail_url?: string | null;
  status?: "draft" | "published";
  product_id?: string | null;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  if (!(await ownedCourseId(admin, userId, { courseId: input.id }))) {
    return { ok: false, message: "Not found" };
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.thumbnail_url !== undefined) patch.thumbnail_url = input.thumbnail_url;
  if (input.status !== undefined) patch.status = input.status;
  if (input.product_id !== undefined) patch.product_id = input.product_id || null;

  const { error } = await admin.from("courses").update(patch).eq("id", input.id);
  if (error) {
    // 23505 = a product is already linked to another course (product_id unique).
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, message: "That product is already linked to another course." };
    }
    return { ok: false, message: error.message };
  }
  revalidatePath(`/dashboard/courses/${input.id}`);
  revalidatePath("/dashboard/courses");
  return { ok: true };
}

export async function deleteCourseAction(id: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  if (!(await ownedCourseId(admin, userId, { courseId: id }))) {
    return { ok: false, message: "Not found" };
  }
  await admin.from("courses").delete().eq("id", id);
  revalidatePath("/dashboard/courses");
  return { ok: true };
}

export async function addModuleAction(input: {
  courseId: string;
  title: string;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  if (!(await ownedCourseId(admin, userId, { courseId: input.courseId }))) {
    return { ok: false, message: "Not found" };
  }
  const sort_order = await nextSort(admin, "course_modules", "course_id", input.courseId);
  const { error } = await admin
    .from("course_modules")
    .insert({ course_id: input.courseId, title: input.title?.trim() || "Untitled module", sort_order });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/dashboard/courses/${input.courseId}`);
  return { ok: true };
}

export async function updateModuleAction(input: {
  moduleId: string;
  title: string;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const courseId = await ownedCourseId(admin, userId, { moduleId: input.moduleId });
  if (!courseId) return { ok: false, message: "Not found" };
  const { error } = await admin
    .from("course_modules")
    .update({ title: input.title.trim() })
    .eq("id", input.moduleId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

export async function deleteModuleAction(moduleId: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const courseId = await ownedCourseId(admin, userId, { moduleId });
  if (!courseId) return { ok: false, message: "Not found" };
  await admin.from("course_modules").delete().eq("id", moduleId);
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

export async function addLessonAction(input: {
  moduleId: string;
  title: string;
  video_url?: string;
  content?: string;
  duration_label?: string;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const courseId = await ownedCourseId(admin, userId, { moduleId: input.moduleId });
  if (!courseId) return { ok: false, message: "Not found" };
  const sort_order = await nextSort(admin, "course_lessons", "module_id", input.moduleId);
  const { error } = await admin.from("course_lessons").insert({
    module_id: input.moduleId,
    title: input.title?.trim() || "Untitled lesson",
    video_url: input.video_url?.trim() || null,
    content: input.content?.trim() || null,
    duration_label: input.duration_label?.trim() || null,
    sort_order,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

export async function updateLessonAction(input: {
  lessonId: string;
  title?: string;
  video_url?: string | null;
  content?: string | null;
  duration_label?: string | null;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const courseId = await ownedCourseId(admin, userId, { lessonId: input.lessonId });
  if (!courseId) return { ok: false, message: "Not found" };
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.video_url !== undefined) patch.video_url = input.video_url || null;
  if (input.content !== undefined) patch.content = input.content || null;
  if (input.duration_label !== undefined) patch.duration_label = input.duration_label || null;
  const { error } = await admin.from("course_lessons").update(patch).eq("id", input.lessonId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

export async function deleteLessonAction(lessonId: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const courseId = await ownedCourseId(admin, userId, { lessonId });
  if (!courseId) return { ok: false, message: "Not found" };
  await admin.from("course_lessons").delete().eq("id", lessonId);
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}
