import { Suspense } from "react";

import { PageBuilderWizard } from "@/components/dashboard/PageBuilder/Wizard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "New page",
};

export default async function NewPagePage() {
  // Seller's creator category drives which templates are recommended first.
  let creatorCategory: string | null = null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("creator_category")
      .eq("id", user.id)
      .single();
    creatorCategory = data?.creator_category ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Create a page</h1>
        <p className="text-sm text-muted-foreground">
          Pick a template, customise the fields, and publish.
        </p>
      </div>
      {/* Wizard reads ?type= via useSearchParams — needs a Suspense boundary. */}
      <Suspense>
        <PageBuilderWizard creatorCategory={creatorCategory} />
      </Suspense>
    </div>
  );
}
