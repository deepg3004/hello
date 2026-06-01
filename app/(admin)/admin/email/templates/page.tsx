import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  EmailTemplateGallery,
  type GalleryItem,
} from "@/components/admin/EmailTemplateGallery";
import { EMAIL_CATALOG } from "@/lib/emails/catalog";
import { primeEmailBranding } from "@/lib/emails/branding";

export const metadata = { title: "Admin · Email templates" };

export default async function EmailTemplatesPage() {
  // Make the previews use the live brand name + logo.
  await primeEmailBranding(true);

  const items: GalleryItem[] = EMAIL_CATALOG.map((t) => {
    const built = t.render();
    return {
      key: t.key,
      label: t.label,
      audience: t.audience,
      live: t.live,
      description: t.description,
      subject: built.subject,
      html: built.html,
    };
  });

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
          Preview every transactional email exactly as buyers and sellers
          receive it — rendered with sample data and your live brand. “Live”
          templates are wired to real events; “Sample only” exist but aren&apos;t
          triggered yet.
        </p>
      </div>

      <EmailTemplateGallery items={items} />
    </div>
  );
}
