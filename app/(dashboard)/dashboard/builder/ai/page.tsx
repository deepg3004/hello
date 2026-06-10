import { AiGenerator } from "@/components/builder/AiGenerator";
import { BuilderTabs } from "@/components/builder/BuilderTabs";
import { aiGeneratorEnabled } from "@/lib/ai/generate-site";

export const metadata = { title: "AI Website Generator" };
export const dynamic = "force-dynamic";

// One-click AI page generation — describe the business, get a premium landing
// page in the builder, ready to edit.
export default async function BuilderAiPage() {
  const enabled = await aiGeneratorEnabled();
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">AI Website Generator</h1>
        <p className="text-sm text-muted-foreground">
          Describe your business and let AI design a premium landing page you can edit.
        </p>
      </div>
      <BuilderTabs />
      <AiGenerator disabled={!enabled} />
    </div>
  );
}
