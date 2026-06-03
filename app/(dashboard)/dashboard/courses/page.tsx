import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Build a course, link it to a product, and buyers get instant access
          after purchase.
        </p>
      </div>
      <CoursesClient courses={(data ?? []) as CourseRow[]} />
    </div>
  );
}
