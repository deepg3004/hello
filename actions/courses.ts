"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { slugify } from "@/lib/templates/utils";

interface Result {
  ok: boolean;
  message?: string;
  id?: string;
  salesPath?: string;
}

// Effective account-owner id when the actor may manage courses, else null.
async function currentUserId(): Promise<string | null> {
  const actor = await requireActor("courses.manage");
  return actor.ok ? actor.ctx.ownerId : null;
}

const VIDEO_BUCKET = "course-media";

/** Re-enqueue a failed HLS transcode for one of the SELLER'S OWN videos. Course
 *  video raw paths are namespaced `course/<ownerId>/video/...`, so a prefix
 *  match proves ownership. Mirrors the admin retry but self-serve, so sellers
 *  aren't stuck waiting on an operator after a failed upload. */
export async function retryMyTranscodeAction(rawPath: string): Promise<Result> {
  const actor = await requireActor("courses.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const path = (rawPath ?? "").replace(/^cmedia:/, "");
  if (!path.startsWith(`course/${ctx.ownerId}/`)) {
    return { ok: false, message: "That video isn't on your account." };
  }

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("hls_assets")
    .select("raw_path")
    .eq("raw_path", path)
    .maybeSingle();
  if (!asset) return { ok: false, message: "Video not found." };

  // The raw upload must still exist (it's deleted after a successful encode).
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash);
  const file = path.slice(slash + 1);
  const { data: listed } = await admin.storage.from(VIDEO_BUCKET).list(dir, { search: file });
  if (!(listed ?? []).some((f) => f.name === file)) {
    return {
      ok: false,
      message: "The original upload is gone — please re-upload the video.",
    };
  }

  await admin
    .from("hls_assets")
    .update({ status: "processing", error: null, updated_at: new Date().toISOString() })
    .eq("raw_path", path);

  const { enqueueHlsJob } = await import("@/lib/queues/hls");
  await enqueueHlsJob(path);

  return { ok: true };
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

async function uniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  const seed = slugify(base) || `course-${nanoid(6).toLowerCase()}`;
  let candidate = seed;
  for (let i = 0; i < 5; i++) {
    const { data } = await admin
      .from("pages")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${seed}-${nanoid(4).toLowerCase()}`;
  }
  return `${seed}-${nanoid(8).toLowerCase()}`;
}

/**
 * One-click "make sellable": create (or update) a published Course Sales Page
 * + product for the course, link it via courses.product_id. Purchase→enrollment
 * then works automatically (lib/courses.createEnrollmentForOrder).
 */
export async function makeCourseSellableAction(input: {
  courseId: string;
  price: number;
  originalPrice?: number | null;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  if (!(await ownedCourseId(admin, userId, { courseId: input.courseId }))) {
    return { ok: false, message: "Not found" };
  }

  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: "Enter a price greater than 0." };
  }
  const original =
    input.originalPrice != null && Number(input.originalPrice) > price
      ? Math.round(Number(input.originalPrice))
      : null;

  const { data: course } = await admin
    .from("courses")
    .select("title, description, thumbnail_url, product_id")
    .eq("id", input.courseId)
    .single();
  if (!course) return { ok: false, message: "Not found" };

  // Already linked → just update the product price + ensure the page is live.
  if (course.product_id) {
    await admin
      .from("products")
      .update({ price, original_price: original, active: true })
      .eq("id", course.product_id);
    const { data: prod } = await admin
      .from("products")
      .select("page_id")
      .eq("id", course.product_id)
      .single();
    let salesPath: string | undefined;
    if (prod?.page_id) {
      await admin.from("pages").update({ status: "published" }).eq("id", prod.page_id);
      const { data: pg } = await admin
        .from("pages")
        .select("slug")
        .eq("id", prod.page_id)
        .single();
      if (pg?.slug) salesPath = `/p/${pg.slug}`;
    }
    revalidatePath(`/dashboard/courses/${input.courseId}`);
    return { ok: true, salesPath };
  }

  // Create the sales page (Course Sales Page template) + product.
  const slug = await uniqueSlug(admin, course.title);
  const page_config: Record<string, unknown> = {
    hero_eyebrow: "Online Course",
    hero_headline: course.title,
    hero_subheadline:
      course.description || "Get lifetime access to this course.",
    hero_cta: "Get this course",
    checkout_title: "Enroll now",
    checkout_guarantee: "Instant access right after payment.",
  };
  if (course.thumbnail_url) page_config.hero_image = course.thumbnail_url;

  const { data: page, error: pageErr } = await admin
    .from("pages")
    .insert({
      user_id: userId,
      title: course.title,
      slug,
      type: "payment",
      template_id: "course",
      status: "published",
      page_config,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (pageErr || !page) {
    return { ok: false, message: pageErr?.message ?? "Couldn't create the sales page" };
  }

  const { data: product, error: prodErr } = await admin
    .from("products")
    .insert({
      user_id: userId,
      page_id: page.id,
      name: course.title,
      price,
      original_price: original,
      currency: "INR",
      type: "one_time",
      active: true,
      image_url: course.thumbnail_url ?? null,
    })
    .select("id")
    .single();
  if (prodErr || !product) {
    return { ok: false, message: prodErr?.message ?? "Couldn't create the product" };
  }

  await admin
    .from("courses")
    .update({ product_id: product.id, updated_at: new Date().toISOString() })
    .eq("id", input.courseId);

  revalidatePath(`/dashboard/courses/${input.courseId}`);
  revalidatePath("/dashboard/courses");
  return { ok: true, salesPath: `/p/${slug}` };
}

export async function createCourseAction(input: { title: string }): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const title = input.title?.trim();
  if (!title) return { ok: false, message: "Title is required" };

  const admin = createAdminClient();
  const slug = `${slugify(title) || "course"}-${nanoid(6)}`;
  const { data, error } = await admin
    .from("courses")
    .insert({ seller_user_id: userId, title, slug })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Failed" };
  revalidatePath("/dashboard/courses");
  return { ok: true, id: data.id };
}

export async function updateCourseAction(input: {
  id: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  status?: "draft" | "published";
  product_id?: string | null;
  category?: string | null;
  level?: string | null;
  language?: string | null;
  what_you_learn?: string[];
  requirements?: string[];
  who_for?: string[];
  instructor_name?: string | null;
  instructor_bio?: string | null;
  instructor_avatar?: string | null;
  promo_video_url?: string | null;
  offer_config?: {
    enabled: boolean;
    title: string;
    text: string;
    cta_label: string;
    cta_url: string;
  } | null;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  if (!(await ownedCourseId(admin, userId, { courseId: input.id }))) {
    return { ok: false, message: "Not found" };
  }
  const cleanList = (xs: string[]) =>
    xs.map((s) => s.trim()).filter(Boolean).slice(0, 30);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
  if (input.description !== undefined) patch.description = input.description;
  if (input.thumbnail_url !== undefined) patch.thumbnail_url = input.thumbnail_url;
  if (input.status !== undefined) patch.status = input.status;
  if (input.product_id !== undefined) patch.product_id = input.product_id || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.level !== undefined) patch.level = input.level;
  if (input.language !== undefined) patch.language = input.language || "English";
  if (input.what_you_learn !== undefined) patch.what_you_learn = cleanList(input.what_you_learn);
  if (input.requirements !== undefined) patch.requirements = cleanList(input.requirements);
  if (input.who_for !== undefined) patch.who_for = cleanList(input.who_for);
  if (input.instructor_name !== undefined) patch.instructor_name = input.instructor_name;
  if (input.instructor_bio !== undefined) patch.instructor_bio = input.instructor_bio;
  if (input.instructor_avatar !== undefined) patch.instructor_avatar = input.instructor_avatar;
  if (input.promo_video_url !== undefined) patch.promo_video_url = input.promo_video_url;
  if (input.offer_config !== undefined) {
    const o = input.offer_config;
    patch.offer_config = o
      ? {
          enabled: !!o.enabled,
          title: (o.title ?? "").trim().slice(0, 120),
          text: (o.text ?? "").trim().slice(0, 300),
          cta_label: (o.cta_label ?? "").trim().slice(0, 40),
          cta_url: (o.cta_url ?? "").trim().slice(0, 500),
        }
      : null;
  }

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
  is_preview?: boolean;
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
    is_preview: !!input.is_preview,
    sort_order,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

const LESSON_TYPES = ["video", "text", "pdf", "image"] as const;
type LessonType = (typeof LESSON_TYPES)[number];

export async function updateLessonAction(input: {
  lessonId: string;
  title?: string;
  video_url?: string | null;
  content?: string | null;
  duration_label?: string | null;
  is_preview?: boolean;
  lesson_type?: LessonType;
  asset_url?: string | null;
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
  if (input.is_preview !== undefined) patch.is_preview = !!input.is_preview;
  if (input.lesson_type !== undefined && LESSON_TYPES.includes(input.lesson_type)) {
    patch.lesson_type = input.lesson_type;
  }
  if (input.asset_url !== undefined) patch.asset_url = input.asset_url || null;
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
