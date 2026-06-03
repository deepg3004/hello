// Preview iframe target used by the page builder.
//
// URL: /preview/{templateId}?v={base64-encoded JSON of values}
//      &chrome=0  (optional — hides the "Preview Mode" banner)
//
// Renders the template with the supplied values and a stub product so the
// checkout / lead-capture form area still composes correctly. No DB calls.

import { notFound } from "next/navigation";
import { Eye } from "lucide-react";

import { getTemplate } from "@/lib/templates/registry";
import { PageSkin } from "@/components/templates/PageSkin";
import { CheckoutConfigProvider } from "@/components/pages/CheckoutConfig";
import { checkoutConfigFromValues } from "@/lib/checkout-config";
import { decodeValues } from "@/lib/templates/utils";
import { getPreview } from "@/lib/preview-store";

export const dynamic = "force-dynamic";

export default function PreviewPage({
  params,
  searchParams,
}: {
  params: { templateId: string };
  searchParams: { v?: string; k?: string; chrome?: string };
}) {
  const template = getTemplate(params.templateId);
  if (!template) notFound();

  // Preferred path: a short token (?k=) whose values were POSTed to
  // /api/preview-token — keeps this URL tiny. Falls back to the inline ?v=
  // payload (older clients / the external "Open" link) or defaults.
  let values: Record<string, unknown> = { ...template.defaultValues };
  if (searchParams.k) {
    const json = getPreview(searchParams.k);
    if (json) {
      try {
        values = JSON.parse(json) as Record<string, unknown>;
      } catch {
        /* keep defaults */
      }
    }
  } else if (searchParams.v) {
    values = decodeValues(searchParams.v);
  }
  const showChrome = searchParams.chrome !== "0";

  const stubProduct = {
    id: "preview",
    name: "Sample product",
    description: "This is a preview — the live page uses your real product.",
    image_url: null,
    price: 999,
    currency: "INR",
  };

  return (
    <div className="relative">
      {showChrome && (
        <div className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/90 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur">
          <span className="inline-flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            Preview mode — not saved. Click outside the preview to edit fields.
          </span>
        </div>
      )}
      <PageSkin values={values as Record<string, unknown>}>
        <CheckoutConfigProvider config={checkoutConfigFromValues(values)}>
          <template.Render
            values={values}
            pageId="preview"
            product={stubProduct}
            products={[stubProduct]}
            isPreview
          />
        </CheckoutConfigProvider>
      </PageSkin>
    </div>
  );
}
