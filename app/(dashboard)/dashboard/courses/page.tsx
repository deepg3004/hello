import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import {
  CoursesClient,
  type CourseRow,
} from "@/components/dashboard/courses/CoursesClient";

export const metadata = { title: "Courses" };

// Decorative sparkline (counts aren't a time series) — matches the Telegram
// page, which also reuses a spark for non-series stat cards.
const SPARK = [4, 6, 5, 7, 6, 8, 7, 9];

export default async function CoursesPage() {
  const ctx = await requirePageActor("courses.view", "/dashboard/courses");

  const admin = createAdminClient();
  const { data } = await admin
    .from("courses")
    .select("id, title, status, created_at")
    .eq("seller_user_id", ctx.ownerId)
    .order("created_at", { ascending: false });

  const courses = (data ?? []) as Array<{
    id: string;
    title: string;
    status: "draft" | "published";
    created_at: string;
  }>;
  const ids = courses.map((c) => c.id);

  // Per-course lesson + student (enrollment) counts.
  const lessonByCourse = new Map<string, number>();
  const studentByCourse = new Map<string, number>();
  if (ids.length) {
    const { data: mods } = await admin
      .from("course_modules")
      .select("id, course_id")
      .in("course_id", ids);
    const modToCourse = new Map(
      (mods ?? []).map((m) => [m.id as string, m.course_id as string]),
    );
    const modIds = (mods ?? []).map((m) => m.id);
    if (modIds.length) {
      const { data: les } = await admin
        .from("course_lessons")
        .select("module_id")
        .in("module_id", modIds);
      for (const l of les ?? []) {
        const cid = modToCourse.get(l.module_id as string);
        if (cid) lessonByCourse.set(cid, (lessonByCourse.get(cid) ?? 0) + 1);
      }
    }
    const { data: enr } = await admin
      .from("course_enrollments")
      .select("course_id")
      .in("course_id", ids);
    for (const e of enr ?? []) {
      const cid = e.course_id as string;
      studentByCourse.set(cid, (studentByCourse.get(cid) ?? 0) + 1);
    }
  }

  const rows: CourseRow[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    students: studentByCourse.get(c.id) ?? 0,
    lessons: lessonByCourse.get(c.id) ?? 0,
  }));

  const published = rows.filter((c) => c.status === "published").length;
  const students = [...studentByCourse.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Courses"
        blurb="Build a course, link it to a product, and buyers get instant access after they purchase."
        gradient="from-violet-600 via-purple-600 to-fuchsia-600"
        resourcesHref={null}
      />

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard label="Courses" value={rows.length.toLocaleString("en-IN")} trendPct={null} spark={SPARK} color="#8b5cf6" />
        <PageStatCard label="Published" value={published.toLocaleString("en-IN")} trendPct={null} spark={SPARK} color="#10b981" />
        <PageStatCard label="Students" value={students.toLocaleString("en-IN")} trendPct={null} spark={SPARK} color="#6366f1" />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <CoursesClient courses={rows} />
      </div>
    </div>
  );
}
