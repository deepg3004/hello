import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CoursePlayerClient,
  type PlayerModule,
} from "@/components/courses/CoursePlayerClient";

export const metadata = { title: "Preview course" };

export default async function CoursePreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requirePageActor("courses.view", "/dashboard/courses");

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, seller_user_id, title, description")
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
        .select("id, module_id, title, video_url, content, duration_label, sort_order")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true })
    : { data: [] as never[] };

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
        completed: false,
      })),
  }));

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Link
          href={`/dashboard/courses/${course.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to editor
        </Link>
      </div>
      <CoursePlayerClient
        token=""
        title={course.title}
        description={course.description ?? null}
        modules={playerModules}
        preview
      />
    </div>
  );
}
