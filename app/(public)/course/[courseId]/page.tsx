import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCourseToken, signPreviewToken } from "@/lib/course-token";
import { createEnrollmentForOrder } from "@/lib/courses";
import { publicPageUrl } from "@/lib/page-url";
import { extractSubdomain } from "@/lib/domains";
import { getReviewSummary, getReviewSummaries, listReviews } from "@/lib/reviews";
import { resolveSurfaceConfig } from "@/lib/storefront-theme";
import { StorefrontShell } from "@/components/store/StorefrontShell";
import {
  CoursePlayerClient,
  type PlayerModule,
} from "@/components/courses/CoursePlayerClient";
import { CourseLanding, type LandingModule } from "@/components/courses/CourseLanding";
import type { CourseCardItem } from "@/components/courses/CourseCard";

export const metadata = { title: "Course" };
export const dynamic = "force-dynamic";

type PageRel = {
  slug: string;
  type: string | null;
  template_id: string | null;
  status: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COURSE_FIELDS =
  "id, seller_user_id, product_id, title, subtitle, description, thumbnail_url, status, slug, category, level, language, what_you_learn, requirements, who_for, instructor_name, instructor_bio, instructor_avatar, updated_at";

function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: { courseId: string };
  searchParams?: { t?: string };
}) {
  const admin = createAdminClient();

  // Resolve the course by id (enrollment links + tokens) or by slug (clean
  // /course/<slug> URLs — scoped to the seller behind the request host).
  let course: Record<string, unknown> | null = null;
  if (UUID_RE.test(params.courseId)) {
    const { data } = await admin.from("courses").select(COURSE_FIELDS).eq("id", params.courseId).maybeSingle();
    course = data;
  } else {
    const host = headers().get("host") ?? "";
    const username = extractSubdomain(host);
    if (username) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("id")
        .eq("subdomain", username)
        .maybeSingle();
      if (profile?.id) {
        const { data } = await admin
          .from("courses")
          .select(COURSE_FIELDS)
          .eq("seller_user_id", profile.id)
          .eq("slug", params.courseId)
          .maybeSingle();
        course = data;
      }
    }
    // Fallback: slug is globally unique enough (per-seller unique + id suffix).
    if (!course) {
      const { data } = await admin.from("courses").select(COURSE_FIELDS).eq("slug", params.courseId).maybeSingle();
      course = data;
    }
  }
  if (!course || course.status !== "published") notFound();

  const courseId = course.id as string;
  const sellerUserId = course.seller_user_id as string;
  const productId = (course.product_id as string | null) ?? null;

  const { data: modulesRaw } = await admin
    .from("course_modules")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  const modules = modulesRaw ?? [];
  const moduleIds = modules.map((m) => m.id);
  const { data: lessonsRaw } = moduleIds.length
    ? await admin
        .from("course_lessons")
        .select("id, module_id, title, video_url, content, duration_label, is_preview, sort_order")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true })
    : { data: [] as never[] };
  const lessons = lessonsRaw ?? [];

  // ── Access check: a valid token + matching enrollment unlocks the player ──
  const token = searchParams?.t ?? "";
  const payload = token ? verifyCourseToken(token) : null;
  let enrollmentId: string | null = null;
  if (payload && payload.course_id === courseId) {
    const { data: enrollment } = await admin
      .from("course_enrollments")
      .select("id")
      .eq("course_id", courseId)
      .eq("order_id", payload.order_id)
      .maybeSingle();
    enrollmentId = enrollment?.id ?? null;

    // Just-in-time enrollment heal (paid before the course was published/linked).
    if (!enrollmentId) {
      const { data: order } = await admin
        .from("orders")
        .select("id, status, product_id, buyer_email")
        .eq("id", payload.order_id)
        .maybeSingle();
      if (order && order.status === "paid" && order.product_id === productId) {
        await createEnrollmentForOrder(
          { id: order.id, product_id: order.product_id, buyer_email: order.buyer_email },
          admin,
        );
        const { data: healed } = await admin
          .from("course_enrollments")
          .select("id")
          .eq("course_id", courseId)
          .eq("order_id", payload.order_id)
          .maybeSingle();
        enrollmentId = healed?.id ?? null;
      }
    }
  }

  // ── Enrolled → full student player ──
  if (enrollmentId) {
    const { data: progress } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("enrollment_id", enrollmentId);
    const completed = new Set((progress ?? []).map((p) => p.lesson_id));
    const playerModules: PlayerModule[] = modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: lessons
        .filter((l) => l.module_id === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          video_url: l.video_url ?? null,
          content: l.content ?? null,
          duration_label: l.duration_label ?? null,
          completed: completed.has(l.id),
        })),
    }));
    return (
      <CoursePlayerClient
        token={token}
        title={course.title as string}
        description={(course.description as string | null) ?? null}
        modules={playerModules}
        watermark={payload?.email ?? null}
      />
    );
  }

  // ── Not enrolled → Udemy-style public landing ──
  const [{ data: seller }, productResult, summary, reviews, { count: students }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("full_name, legal_business_name, avatar_url, storefront_config")
      .eq("id", sellerUserId)
      .maybeSingle(),
    productId
      ? admin
          .from("products")
          .select("price, original_price, pages!products_page_id_fkey(slug, type, template_id, status)")
          .eq("id", productId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getReviewSummary("course", courseId),
    listReviews("course", courseId, 30),
    admin.from("course_enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);

  const product = productResult.data as
    | { price: number; original_price: number | null; pages: PageRel | PageRel[] | null }
    | null;
  const page = product ? (Array.isArray(product.pages) ? product.pages[0] : product.pages) : null;
  const checkoutUrl =
    page && page.status === "published" ? publicPageUrl(page.type, page.slug, page.template_id) : null;

  const landingModules: LandingModule[] = modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: lessons
      .filter((l) => l.module_id === m.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        duration_label: l.duration_label ?? null,
        is_preview: !!l.is_preview,
        video_url: l.video_url ?? null,
      })),
  }));
  const previewLessons = lessons
    .filter((l) => l.is_preview && l.video_url)
    .map((l) => ({ id: l.id, title: l.title, video_url: l.video_url ?? null, duration_label: l.duration_label ?? null }));

  // Related — other published courses by this seller.
  const { data: relRaw } = await admin
    .from("courses")
    .select("id, slug, title, subtitle, thumbnail_url, instructor_name, level, category, product_id")
    .eq("seller_user_id", sellerUserId)
    .eq("status", "published")
    .neq("id", courseId)
    .limit(6);
  const relCourses = (relRaw ?? []) as Array<{
    id: string;
    slug: string | null;
    title: string;
    subtitle: string | null;
    thumbnail_url: string | null;
    instructor_name: string | null;
    level: string | null;
    category: string | null;
    product_id: string | null;
  }>;
  const relProductIds = relCourses.map((c) => c.product_id).filter((x): x is string => !!x);
  const priceByProduct = new Map<string, { price: number; original: number | null }>();
  if (relProductIds.length) {
    const { data: prods } = await admin
      .from("products")
      .select("id, price, original_price")
      .in("id", relProductIds);
    for (const p of (prods ?? []) as Array<{ id: string; price: number; original_price: number | null }>) {
      priceByProduct.set(p.id, { price: Number(p.price ?? 0), original: p.original_price != null ? Number(p.original_price) : null });
    }
  }
  const relRatings = await getReviewSummaries("course", relCourses.map((c) => c.id));
  const lessonCountByCourse = new Map<string, number>();
  if (relCourses.length) {
    const { data: relMods } = await admin
      .from("course_modules")
      .select("id, course_id")
      .in("course_id", relCourses.map((c) => c.id));
    const relModIds = (relMods ?? []) as Array<{ id: string; course_id: string }>;
    if (relModIds.length) {
      const { data: relLessons } = await admin
        .from("course_lessons")
        .select("module_id")
        .in("module_id", relModIds.map((m) => m.id));
      const courseByModule = new Map(relModIds.map((m) => [m.id, m.course_id]));
      for (const l of (relLessons ?? []) as Array<{ module_id: string }>) {
        const cid = courseByModule.get(l.module_id);
        if (cid) lessonCountByCourse.set(cid, (lessonCountByCourse.get(cid) ?? 0) + 1);
      }
    }
  }
  const related: CourseCardItem[] = relCourses.map((c) => {
    const price = c.product_id ? priceByProduct.get(c.product_id) : null;
    const r = relRatings.get(c.id);
    return {
      id: c.id,
      slug: c.slug ?? c.id,
      title: c.title,
      subtitle: c.subtitle,
      thumbnail_url: c.thumbnail_url,
      instructor: c.instructor_name,
      level: c.level,
      category: c.category,
      price: price ? price.price : null,
      original_price: price ? price.original : null,
      lessons: lessonCountByCourse.get(c.id) ?? 0,
      students: 0,
      rating: { average: r?.average ?? 0, count: r?.count ?? 0 },
    };
  });

  const sellerName = seller?.legal_business_name ?? seller?.full_name ?? null;
  const cfg = resolveSurfaceConfig(seller?.storefront_config, "course");

  return (
    <StorefrontShell cfg={cfg}>
    <CourseLanding
      courseId={courseId}
      title={course.title as string}
      subtitle={(course.subtitle as string | null) ?? null}
      description={(course.description as string | null) ?? null}
      thumbnailUrl={(course.thumbnail_url as string | null) ?? null}
      sellerName={sellerName}
      category={(course.category as string | null) ?? null}
      level={(course.level as string | null) ?? null}
      language={(course.language as string | null) ?? "English"}
      updatedAt={(course.updated_at as string | null) ?? null}
      instructor={{
        name: (course.instructor_name as string | null) ?? null,
        bio: (course.instructor_bio as string | null) ?? null,
        avatar: (course.instructor_avatar as string | null) ?? seller?.avatar_url ?? null,
      }}
      whatYouLearn={asList(course.what_you_learn)}
      requirements={asList(course.requirements)}
      whoFor={asList(course.who_for)}
      modules={landingModules}
      priceRupees={product ? Number(product.price) : null}
      originalPriceRupees={product && product.original_price != null ? Number(product.original_price) : null}
      checkoutUrl={checkoutUrl}
      previewLessons={previewLessons}
      previewToken={signPreviewToken(courseId)}
      rating={summary}
      reviews={reviews}
      students={students ?? 0}
      related={related}
      cardStyle={cfg.card}
      showRatings={cfg.sections.ratings}
      showRelated={cfg.sections.related}
    />
    </StorefrontShell>
  );
}
