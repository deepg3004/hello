import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCourseToken } from "@/lib/course-token";
import { publicPageUrl } from "@/lib/page-url";
import {
  CoursePlayerClient,
  type PlayerModule,
} from "@/components/courses/CoursePlayerClient";
import {
  CourseLanding,
  type LandingModule,
} from "@/components/courses/CourseLanding";

export const metadata = { title: "Course" };

type PageRel = {
  slug: string;
  type: string | null;
  template_id: string | null;
  status: string | null;
};

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: { courseId: string };
  searchParams?: { t?: string };
}) {
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("id, seller_user_id, product_id, title, description, thumbnail_url, status")
    .eq("id", params.courseId)
    .single();
  // Only published courses have a public page; drafts use the seller Preview.
  if (!course || course.status !== "published") notFound();

  const { data: modules } = await admin
    .from("course_modules")
    .select("id, title, sort_order")
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await admin
        .from("course_lessons")
        .select("id, module_id, title, video_url, content, duration_label, sort_order")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true })
    : { data: [] as never[] };

  // ── Access check: a valid token + matching enrollment unlocks the player ──
  const token = searchParams?.t ?? "";
  const payload = token ? verifyCourseToken(token) : null;
  let enrollmentId: string | null = null;
  if (payload && payload.course_id === course.id) {
    const { data: enrollment } = await admin
      .from("course_enrollments")
      .select("id")
      .eq("course_id", course.id)
      .eq("order_id", payload.order_id)
      .maybeSingle();
    enrollmentId = enrollment?.id ?? null;
  }

  // ── Enrolled → full student player ──
  if (enrollmentId) {
    const { data: progress } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("enrollment_id", enrollmentId);
    const completed = new Set((progress ?? []).map((p) => p.lesson_id));

    const playerModules: PlayerModule[] = (modules ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      lessons: (lessons ?? [])
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
        title={course.title}
        description={course.description ?? null}
        modules={playerModules}
      />
    );
  }

  // ── Not enrolled → public landing page (curriculum locked + buy CTA) ──
  const [{ data: seller }, productResult] = await Promise.all([
    admin
      .from("user_profiles")
      .select("full_name, legal_business_name")
      .eq("id", course.seller_user_id)
      .maybeSingle(),
    course.product_id
      ? admin
          .from("products")
          .select(
            "price, original_price, pages!products_page_id_fkey(slug, type, template_id, status)",
          )
          .eq("id", course.product_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const product = productResult.data as
    | { price: number; original_price: number | null; pages: PageRel | PageRel[] | null }
    | null;
  const page = product
    ? Array.isArray(product.pages)
      ? product.pages[0]
      : product.pages
    : null;
  const checkoutUrl =
    page && page.status === "published"
      ? publicPageUrl(page.type, page.slug, page.template_id)
      : null;

  const landingModules: LandingModule[] = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => ({ id: l.id, title: l.title, duration_label: l.duration_label ?? null })),
  }));

  return (
    <CourseLanding
      title={course.title}
      description={course.description ?? null}
      sellerName={seller?.legal_business_name ?? seller?.full_name ?? null}
      thumbnailUrl={course.thumbnail_url ?? null}
      modules={landingModules}
      priceRupees={product ? Number(product.price) : null}
      originalPriceRupees={
        product && product.original_price != null ? Number(product.original_price) : null
      }
      checkoutUrl={checkoutUrl}
    />
  );
}
