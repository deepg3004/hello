import { BuilderEditor } from "@/components/builder/BuilderEditor";
import { BuilderTabs } from "@/components/builder/BuilderTabs";

export const metadata = { title: "Website Builder" };
export const dynamic = "force-dynamic";

// Phase-1 Elementor-style builder. The client editor loads (or bootstraps) the
// seller's builder site via /api/builder/sites/me, so the dashboard auth gate is
// enough here.
export default function BuilderEditorPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Website Builder</h1>
        <p className="text-sm text-muted-foreground">
          Drag-and-drop builder (beta). Build a page, then save your draft.
        </p>
      </div>
      <BuilderTabs />
      <BuilderEditor />
    </div>
  );
}
