// Preview iframe target used by the page builder.
//
// URL: /preview/{templateId}?v={base64-encoded JSON of values}
// Renders the template with the supplied values and a stub product so the
// checkout / lead-capture form area still composes correctly.

import { notFound } from "next/navigation";

import { getTemplate } from "@/lib/templates/registry";
import { decodeValues } from "@/lib/templates/utils";

export const dynamic = "force-dynamic";

export default function PreviewPage({
  params,
  searchParams,
}: {
  params: { templateId: string };
  searchParams: { v?: string };
}) {
  const template = getTemplate(params.templateId);
  if (!template) notFound();

  const encoded = searchParams.v ?? "";
  const values = encoded
    ? decodeValues(encoded)
    : { ...template.defaultValues };

  const stubProduct = {
    id: "preview",
    name: "Sample product",
    description: "This is a preview — the live page uses your real product.",
    image_url: null,
    price: 999,
    currency: "INR",
  };

  return (
    <template.Render values={values} pageId="preview" product={stubProduct} isPreview />
  );
}
