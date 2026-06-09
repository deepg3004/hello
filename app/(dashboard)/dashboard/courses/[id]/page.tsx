import { notFound, redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CourseEditor,
  type EditorCourse,
  type EditorModule,
  type EditorLesson,
} from "@/components/dashboard/courses/CourseEditor";

export const metadata = { title: "Edit course" };

export default async function CourseEditPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requirePageActor("courses.view", "/dashboard/courses");

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select(
      "id, seller_user_id, product_id, title, subtitle, description, thumbnail_url, status, category, level, language, what_you_learn, requirements, who_for, instructor_name, instructor_bio, instructor_avatar, promo_video_url, offer_config",
    )
    .eq("id", params.id)
    .single();
  if (!course || course.seller_user_id !== ctx.ownerId) notFound();

  const { data: modules } = await admin
    .from("course_modules")
    .select("id, title, sort_order")
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await admin
        .from("course_lessons")
        .select("id, module_id, title, video_url, content, duration_label, is_preview, lesson_type, asset_url, sort_order")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true })
    : { data: [] as never[] };

  const { data: products } = await admin
    .from("products")
    .select("id, name")
    .eq("user_id", ctx.ownerId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  // Transcode status for each HLS video lesson (raw path = video_url minus the
  // `cmedia:` prefix) so the editor can show Processing/Ready/Failed + retry.
  const promoRaw = (course.promo_video_url ?? "").replace(/^cmedia:/, "");
  const rawPaths = Array.from(
    new Set(
      [
        ...(lessons ?? []).map((l) => (l.video_url ?? "").replace(/^cmedia:/, "")),
        promoRaw,
      ].filter((p) => p.startsWith(`course/${ctx.ownerId}/`)),
    ),
  );
  const statusByPath = new Map<string, string>();
  if (rawPaths.length) {
    const { data: assets } = await admin
      .from("hls_assets")
      .select("raw_path, status")
      .in("raw_path", rawPaths);
    for (const a of (assets ?? []) as Array<{ raw_path: string; status: string }>) {
      statusByPath.set(a.raw_path, a.status);
    }
  }

  const editorModules: EditorModule[] = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        video_url: l.video_url ?? "",
        content: l.content ?? "",
        duration_label: l.duration_label ?? "",
        is_preview: !!(l as { is_preview?: boolean }).is_preview,
        lesson_type: ((l as { lesson_type?: string }).lesson_type ??
          "video") as EditorLesson["lesson_type"],
        asset_url: (l as { asset_url?: string | null }).asset_url ?? "",
        transcode_status:
          (statusByPath.get((l.video_url ?? "").replace(/^cmedia:/, "")) as
            | EditorLesson["transcode_status"]) ?? null,
      })),
  }));

  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const editorCourse: EditorCourse = {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle ?? "",
    description: course.description ?? "",
    thumbnail_url: course.thumbnail_url ?? "",
    status: course.status as "draft" | "published",
    product_id: course.product_id ?? "",
    category: course.category ?? "",
    level: course.level ?? "",
    language: course.language ?? "English",
    what_you_learn: asList(course.what_you_learn),
    requirements: asList(course.requirements),
    who_for: asList(course.who_for),
    instructor_name: course.instructor_name ?? "",
    instructor_bio: course.instructor_bio ?? "",
    instructor_avatar: course.instructor_avatar ?? "",
    promo_video_url: course.promo_video_url ?? "",
    promo_transcode_status:
      (statusByPath.get(promoRaw) as EditorCourse["promo_transcode_status"]) ?? null,
    offer_config: (course.offer_config as EditorCourse["offer_config"]) ?? null,
  };

  // Sellable state — the linked product's price + its sales page (if any).
  let sale: { price: number; originalPrice: number | null; salesPath: string | null } | null =
    null;
  if (course.product_id) {
    const { data: prod } = await admin
      .from("products")
      .select("price, original_price, page_id")
      .eq("id", course.product_id)
      .maybeSingle();
    if (prod) {
      let salesPath: string | null = null;
      if (prod.page_id) {
        const { data: pg } = await admin
          .from("pages")
          .select("slug, status")
          .eq("id", prod.page_id)
          .maybeSingle();
        if (pg?.slug && pg.status === "published") salesPath = `/p/${pg.slug}`;
      }
      sale = {
        price: Number(prod.price ?? 0),
        originalPrice: prod.original_price != null ? Number(prod.original_price) : null,
        salesPath,
      };
    }
  }

  return (
    <CourseEditor
      course={editorCourse}
      modules={editorModules}
      products={(products ?? []) as { id: string; name: string }[]}
      sale={sale}
    />
  );
}
