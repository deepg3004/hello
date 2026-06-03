import { Suspense } from "react";

import { PageBuilderWizard } from "@/components/dashboard/PageBuilder/Wizard";

export const metadata = {
  title: "New page",
};

export default function NewPagePage() {
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
        <PageBuilderWizard />
      </Suspense>
    </div>
  );
}
