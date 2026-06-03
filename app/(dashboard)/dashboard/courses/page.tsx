import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  CoursesClient,
  type CourseRow,
} from "@/components/dashboard/courses/CoursesClient";

export const metadata = { title: "Courses" };

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
      <div className="animate-in-up" style={{ animationDelay: "0ms" }}>
        <DashboardHero
          title="Courses"
          blurb="Build a course, link it to a product, and buyers get instant access after they purchase."
          resourcesHref={null}
        />
      </div>
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <CoursesClient
          courses={courses}
          stats={{ total: courses.length, published, students }}
        />
      </div>
    </div>
  );
}
