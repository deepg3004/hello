import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/courses");

  const admin = createAdminClient();
  const { data } = await admin
    .from("courses")
    .select("id, title, status, created_at")
    .eq("seller_user_id", user.id)
    .order("created_at", { ascending: false });

  const courses = (data ?? []) as CourseRow[];
  const ids = courses.map((c) => c.id);

  let students = 0;
  if (ids.length) {
    const { count } = await admin
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .in("course_id", ids);
    students = count ?? 0;
  }
  const published = courses.filter((c) => c.status === "published").length;

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
        <PageStatCard
          label="Courses"
          value={courses.length.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#8b5cf6"
        />
        <PageStatCard
          label="Published"
          value={published.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#10b981"
        />
        <PageStatCard
          label="Students"
          value={students.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#6366f1"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <CoursesClient courses={courses} />
      </div>
    </div>
  );
}
