import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCourseToken } from "@/lib/course-token";
import {
  CoursePlayerClient,
  type PlayerModule,
} from "@/components/courses/CoursePlayerClient";

export const metadata = { title: "Course" };

function AccessDenied({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-sora text-xl font-semibold">Can&apos;t open this course</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </main>
  );
}

export default async function CoursePlayerPage({
  params,
  searchParams,
}: {
  params: { courseId: string };
  searchParams?: { t?: string };
}) {
  const token = searchParams?.t ?? "";
  const payload = verifyCourseToken(token);
  if (!payload || payload.course_id !== params.courseId) {
    return <AccessDenied message="This access link is invalid or has expired. Check your purchase receipt for the latest link." />;
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("course_enrollments")
    .select("id, course_id")
    .eq("course_id", payload.course_id)
    .eq("order_id", payload.order_id)
    .maybeSingle();
  if (!enrollment) {
    return <AccessDenied message="We couldn't find your enrollment for this course." />;
  }

  const { data: course } = await admin
    .from("courses")
    .select("id, title, description, status")
    .eq("id", payload.course_id)
    .single();
  if (!course || course.status !== "published") {
    return <AccessDenied message="This course isn't available right now." />;
  }

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

  const { data: progress } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("enrollment_id", enrollment.id);
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
