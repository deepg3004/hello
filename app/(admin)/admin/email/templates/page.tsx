import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EmailTemplatesManager } from "@/components/admin/EmailTemplatesManager";
import {
  listEmailTemplatesAction,
  type TemplateListItem,
} from "@/actions/email-templates";
import { primeEmailBranding } from "@/lib/emails/branding";

export const metadata = { title: "Admin · Email templates" };

export default async function EmailTemplatesPage() {
  await primeEmailBranding(true);
  const res = await listEmailTemplatesAction();
  const items = (res.ok ? (res.data as TemplateListItem[]) : []) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/email"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Email
        </Link>
        <h1 className="font-sora text-2xl font-semibold tracking-tight">
          Email templates
        </h1>
        <p className="text-sm text-muted-foreground">
          Preview, edit, and create the emails your platform sends — rendered
          with your live brand. Editing a built-in template replaces the email
          sent for that event; “Reset to default” reverts to the original.
          Custom templates can be sent on demand or broadcast.
        </p>
      </div>

      <EmailTemplatesManager initial={items} />
    </div>
  );
}
