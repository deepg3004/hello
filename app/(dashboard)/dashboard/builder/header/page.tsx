import { BuilderEditor } from "@/components/builder/BuilderEditor";
import { BuilderTabs } from "@/components/builder/BuilderTabs";

export const metadata = { title: "Header Builder" };
export const dynamic = "force-dynamic";

// Global header — built with the same canvas, shown on every published page.
export default function HeaderBuilderPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Header Builder</h1>
        <p className="text-sm text-muted-foreground">
          Build your global header (logo, menu, social icons, button). Shown on every page.
        </p>
      </div>
      <BuilderTabs />
      <BuilderEditor mode="header" />
    </div>
  );
}
