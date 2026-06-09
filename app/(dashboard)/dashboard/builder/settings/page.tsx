import { SiteContactsForm } from "@/components/builder/SiteContactsForm";
import { BuilderTabs } from "@/components/builder/BuilderTabs";

export const metadata = { title: "Builder Settings" };
export const dynamic = "force-dynamic";

// Site-wide builder settings — contact channels + floating chat.
export default function BuilderSettingsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Builder Settings</h1>
        <p className="text-sm text-muted-foreground">
          Contact channels used across your site (header, footer, mobile bar, floating chat).
        </p>
      </div>
      <BuilderTabs />
      <SiteContactsForm />
    </div>
  );
}
