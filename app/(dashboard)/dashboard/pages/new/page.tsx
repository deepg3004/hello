import { Suspense } from "react";

import { PageBuilderWizard } from "@/components/dashboard/PageBuilder/Wizard";
import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "New page",
};

export default async function NewPagePage() {
  const ctx = await requirePageActor("pages.manage", "/dashboard/pages");
  // Seller's creator category drives which templates are recommended first.
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("creator_category")
    .eq("id", ctx.ownerId)
    .single();
  const creatorCategory = data?.creator_category ?? null;

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
