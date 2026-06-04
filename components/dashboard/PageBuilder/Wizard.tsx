"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TypePicker } from "./TypePicker";
import { TemplatePicker } from "./TemplatePicker";
import { Customizer } from "./Customizer";
import { useToast } from "@/hooks/use-toast";
import { createPageAction } from "@/actions/pages";
import { getTemplate } from "@/lib/templates/registry";
import { usePublicPageUrl } from "@/components/dashboard/SellerContext";
import { isValidSlug } from "@/lib/templates/utils";
import type { PageDbType } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Choose type" },
  { id: 2, label: "Pick a template" },
  { id: 3, label: "Customise" },
];

const VALID_TYPES: PageDbType[] = ["payment", "landing", "lead_magnet"];

export function PageBuilderWizard({
  creatorCategory,
}: {
  creatorCategory?: string | null;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const buildPageUrl = usePublicPageUrl();
  // When launched from a category dashboard the wizard is pre-scoped via query
  // params: ?type= pre-selects the kind (skip to template step), and ?template=
  // jumps straight into customising that specific template.
  const presetTemplate = (() => {
    const id = searchParams.get("template");
    return id ? getTemplate(id) : null;
  })();
  const presetType = (() => {
    if (presetTemplate) return presetTemplate.definition.dbType;
    const t = searchParams.get("type") as PageDbType | null;
    return t && VALID_TYPES.includes(t) ? t : null;
  })();
  const [step, setStep] = useState<Step>(presetTemplate ? 3 : presetType ? 2 : 1);
  const [type, setType] = useState<PageDbType | null>(presetType);
  const [templateId, setTemplateId] = useState<string | null>(
    presetTemplate?.definition.id ?? null,
  );
  const [title, setTitle] = useState(presetTemplate?.definition.name ?? "");
  const [slug, setSlug] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>(
    presetTemplate ? { ...presetTemplate.defaultValues } : {},
  );
  // Price in INR — only shown / sent for "payment" pages. createPageAction
  // auto-creates a matching products row so the public /p/[slug] route has
  // something to charge for.
  const [price, setPrice] = useState<string>("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const template = useMemo(
    () => (templateId ? getTemplate(templateId) : null),
    [templateId],
  );

  function pickTemplate(id: string) {
    const t = getTemplate(id);
    setTemplateId(id);
    setValues({ ...(t?.defaultValues ?? {}) });
    if (!title) setTitle(t?.definition.name ?? "");
    setStep(3);
  }

  async function save(publish: boolean) {
    if (!template || !type) return;
    if (!title.trim()) {
      toast({ title: "Page title is required", variant: "destructive" });
      return;
    }
    if (!isValidSlug(slug)) {
      toast({
        title: "Pick a valid slug",
        description: "Lowercase letters, numbers and dashes only.",
        variant: "destructive",
      });
      return;
    }
    // Parse the price input. Empty string → null (no product created).
    // Only relevant for payment pages — landing / lead_magnet ignore it.
    const parsedPrice =
      type === "payment" && price.trim() !== ""
        ? Number.parseFloat(price)
        : null;
    if (type === "payment" && parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice <= 0)) {
      toast({
        title: "Enter a valid price",
        description: "Price must be a positive number in INR (e.g. 49 or 499.50).",
        variant: "destructive",
      });
      return;
    }
    setSaving(publish ? "publish" : "draft");
    const result = await createPageAction({
      type,
      templateId: template.definition.id,
      title,
      slug,
      values,
      publish,
      price: parsedPrice,
    });
    setSaving(null);
    if (!result.ok) {
      toast({
        title: "Couldn't save",
        description: result.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: publish ? "Page published" : "Saved as draft",
      description: publish
        ? `Live at ${buildPageUrl(type, slug, templateId)}`
        : "You can edit it any time.",
    });
    router.push(`/dashboard/pages/${result.pageId}/edit`);
  }

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <ol className="flex items-center gap-4 text-sm">
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li key={s.id} className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (s.id < step) setStep(s.id);
                }}
                className={cn(
                  "flex items-center gap-2 font-medium transition",
                  active ? "text-foreground" : done ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && "border-foreground/30 bg-muted",
                    !active && !done && "border-foreground/20 text-muted-foreground",
                  )}
                >
                  {s.id}
                </span>
                {s.label}
              </button>
              {idx < STEPS.length - 1 && (
                <span className="h-px w-12 bg-border" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step content */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-sora font-semibold tracking-tight">What kind of page?</h2>
            <p className="text-sm text-muted-foreground">
              You can always change the template later.
            </p>
          </div>
          <TypePicker
            value={type}
            onChange={(v) => {
              setType(v);
              setStep(2);
            }}
          />
        </div>
      )}

      {step === 2 && type && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-sora font-semibold tracking-tight">Pick a template</h2>
              <p className="text-sm text-muted-foreground">
                You&apos;ll be able to customise every field next.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Change type
            </Button>
          </div>
          <TemplatePicker
            type={type}
            value={templateId}
            onChange={pickTemplate}
            creatorCategory={creatorCategory}
          />
        </div>
      )}

      {step === 3 && template && type && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-sora font-semibold tracking-tight">
                Customise: {template.definition.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Edit the fields on the left — the preview updates as you type.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Change template
              </Button>
              <Button
                variant="outline"
                onClick={() => save(false)}
                disabled={saving !== null}
              >
                {saving === "draft" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save draft
              </Button>
              <Button
                onClick={() => save(true)}
                disabled={saving !== null}
              >
                {saving === "publish" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Publish
              </Button>
            </div>
          </div>
          <Customizer
            templateId={template.definition.id}
            title={title}
            onTitleChange={setTitle}
            slug={slug}
            onSlugChange={setSlug}
            values={values}
            onValuesChange={setValues}
            pageType={type}
            price={price}
            onPriceChange={setPrice}
          />
        </div>
      )}
    </div>
  );
}
