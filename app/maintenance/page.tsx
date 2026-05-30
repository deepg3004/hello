import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMaintenanceOn } from "@/lib/maintenance";

export const metadata = { title: "We'll be back shortly" };
export const dynamic = "force-dynamic";

async function readSetting(key: string, fallback: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .single<{ value: string }>();
    return data?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export default async function MaintenancePage() {
  // If the seller turned maintenance back off, don't leave anyone stranded
  // on this page — bounce them home.
  if (!(await isMaintenanceOn())) redirect("/");

  const [platformName, message, logoUrl, supportEmail] = await Promise.all([
    readSetting("platform_name", "InvoxAI"),
    readSetting("maintenance_message", "We'll be back shortly."),
    readSetting("platform_logo_url", ""),
    readSetting("support_email", "support@invoxai.io"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={platformName}
          className="mb-6 h-12 w-auto"
        />
      ) : (
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          {platformName}
        </p>
      )}
      <h1 className="text-3xl font-sora font-semibold tracking-tight">
        We&apos;ll be back shortly
      </h1>
      <p className="mt-3 max-w-md whitespace-pre-line text-muted-foreground">
        {message}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Urgent?{" "}
        <a href={`mailto:${supportEmail}`} className="text-primary underline">
          {supportEmail}
        </a>
      </p>
    </main>
  );
}
