import { BuilderEditor } from "@/components/builder/BuilderEditor";
import { BuilderTabs } from "@/components/builder/BuilderTabs";

export const metadata = { title: "Footer Builder" };
export const dynamic = "force-dynamic";

// Global footer — built with the same canvas, shown on every published page.
export default function FooterBuilderPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Footer Builder</h1>
        <p className="text-sm text-muted-foreground">
          Build your global footer (logo, text, menu, social, copyright). Shown on every page.
        </p>
      </div>
      <BuilderTabs />
      <BuilderEditor mode="footer" />
    </div>
  );
}
