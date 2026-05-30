import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/dashboard/telegram/SetupWizard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Telegram VIP setup" };

export default async function TelegramSetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: pages } = await admin
    .from("pages")
    .select("id, title, template_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Telegram VIP setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Hook up a bot + group so every buyer gets a one-time invite + auto-removal on expiry.
        </p>
      </div>
      <SetupWizard
        pages={(pages ?? []).map((p) => ({
          id: p.id,
          title: p.title,
          template_id: p.template_id ?? "",
        }))}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io"}
      />
    </div>
  );
}
