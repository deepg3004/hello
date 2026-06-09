import { TemplateGallery } from "@/components/builder/TemplateGallery";
import { BuilderTabs } from "@/components/builder/BuilderTabs";

export const metadata = { title: "Builder Templates" };
export const dynamic = "force-dynamic";

// Template gallery — filter by page type + category, apply in one click.
export default function BuilderTemplatesPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Pick a ready-made, premium page and apply it in one click — then edit anything.
        </p>
      </div>
      <BuilderTabs />
      <TemplateGallery />
    </div>
  );
}
