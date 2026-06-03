"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Rocket, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImageInput } from "@/components/ui/ImageInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Customizer } from "./Customizer";
import { DesignTab } from "./DesignTab";
import { LivePreview } from "./LivePreview";
import { FormBuilderTab } from "./FormBuilderTab";
import { ConversionTab } from "./ConversionTab";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { updatePageAction, type UpdatePageInput } from "@/actions/pages";
import type { FormConfig, LeadMagnetMeta } from "@/lib/leads";
import type { CountdownConfig, ExitIntentConfig } from "@/lib/conversion";
import type { OrderBumpConfig, OtoConfig } from "@/lib/upsells";

export interface ExistingPage {
  id: string;
  title: string;
  slug: string;
  type: "payment" | "landing" | "lead_magnet";
  status: "draft" | "published" | "paused" | "archived";
  template_id: string;
  page_config: Record<string, unknown>;
  meta_title: string | null;
  meta_description: string | null;
  custom_domain: string | null;
  pixel?: {
    meta_pixel_id: string | null;
    meta_capi_access_token?: string | null;
    meta_fire_purchase?: boolean | null;
    meta_fire_lead?: boolean | null;
    google_ads_id: string | null;
    google_ads_label: string | null;
    google_fire_conversion?: boolean | null;
    tiktok_pixel_id: string | null;
    hotjar_id: string | null;
    clarity_id?: string | null;
    custom_script?: string | null;
  } | null;
  /** Seller's products + coupons for picker UIs in the Conversion tab. */
  products?: Array<{ id: string; name: string; price: number }>;
  coupons?: Array<{ code: string }>;
  /** Drives whether the custom-script textarea is enabled. */
  customScriptsAllowed?: boolean;
  /** Seller's plan key — drives the Pro+ gate on custom scripts. */
  sellerPlan?: string;
  /** This page's own product price (offer price) + retail/compare-at price. */
  productPrice?: number | null;
  productOriginalPrice?: number | null;
}

export function PageEditorTabs({ initial }: { initial: ExistingPage }) {
  const { toast } = useToast();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [values, setValues] = useState<Record<string, unknown>>(initial.page_config ?? {});
  const [status, setStatus] = useState(initial.status);
  const [metaTitle, setMetaTitle] = useState(initial.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(initial.meta_description ?? "");
  const [customDomain, setCustomDomain] = useState(initial.custom_domain ?? "");
  // Offer price + retail (compare-at) price seeded from THIS page's product.
  // Empty string when no product exists yet.
  const seedPrice = initial.productPrice ?? initial.products?.[0]?.price ?? 0;
  const [price, setPrice] = useState<string>(
    seedPrice > 0 ? String(seedPrice) : "",
  );
  const [originalPrice, setOriginalPrice] = useState<string>(
    (initial.productOriginalPrice ?? 0) > 0
      ? String(initial.productOriginalPrice)
      : "",
  );
  const [pixel, setPixel] = useState({
    meta_pixel_id: initial.pixel?.meta_pixel_id ?? "",
    meta_capi_access_token: initial.pixel?.meta_capi_access_token ?? "",
    meta_fire_purchase: initial.pixel?.meta_fire_purchase ?? true,
    meta_fire_lead: initial.pixel?.meta_fire_lead ?? true,
    google_ads_id: initial.pixel?.google_ads_id ?? "",
    google_ads_label: initial.pixel?.google_ads_label ?? "",
    google_fire_conversion: initial.pixel?.google_fire_conversion ?? true,
    tiktok_pixel_id: initial.pixel?.tiktok_pixel_id ?? "",
    hotjar_id: initial.pixel?.hotjar_id ?? "",
    clarity_id: initial.pixel?.clarity_id ?? "",
    custom_script: initial.pixel?.custom_script ?? "",
  });

  const customScriptsAllowed = initial.customScriptsAllowed ?? false;
  const sellerPlan = initial.sellerPlan ?? "free";
  const customScriptsPlanOk =
    sellerPlan === "pro" || sellerPlan === "business";

  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // ── Unsaved-changes tracking ──────────────────────────────────────────
  // A snapshot of everything the editor persists. We compare the live
  // snapshot to the last-saved one to know whether there are pending edits
  // (drives the Exit confirm dialog + the browser "leave?" guard).
  const snapOf = (s: string) =>
    JSON.stringify({
      title,
      slug,
      values,
      status: s,
      metaTitle,
      metaDescription,
      customDomain,
      pixel,
      price,
      originalPrice,
    });
  const snapshot = snapOf(status);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  useEffect(() => {
    // Mark the initial render as the clean baseline.
    if (savedSnapshot === null) setSavedSnapshot(snapshot);
  }, [snapshot, savedSnapshot]);
  const dirty = savedSnapshot !== null && snapshot !== savedSnapshot;

  const [exitOpen, setExitOpen] = useState(false);

  // Warn before a hard navigation / tab close when there are unsaved edits.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /** Persist the page. `publish` flips the status to published in the same
   *  round-trip. Returns true on success so callers can chain (save & exit). */
  async function save(opts?: { publish?: boolean }): Promise<boolean> {
    // Validate price up-front for payment pages so the seller sees the
    // toast immediately instead of after a slow round-trip.
    const parsedPrice =
      initial.type === "payment" && price.trim() !== ""
        ? Number.parseFloat(price)
        : null;
    if (
      initial.type === "payment" &&
      parsedPrice !== null &&
      (Number.isNaN(parsedPrice) || parsedPrice <= 0)
    ) {
      toast({
        title: "Enter a valid price",
        description: "Price must be a positive number in INR.",
        variant: "destructive",
      });
      return false;
    }
    const parsedOriginal =
      initial.type === "payment" && originalPrice.trim() !== ""
        ? Number.parseFloat(originalPrice)
        : null;
    const nextStatus = opts?.publish ? "published" : status;
    setSaving(true);
    const input: UpdatePageInput = {
      id: initial.id,
      title,
      slug,
      values,
      status: nextStatus,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      custom_domain: customDomain || null,
      pixel,
      price: parsedPrice,
      original_price:
        parsedOriginal !== null && !Number.isNaN(parsedOriginal)
          ? parsedOriginal
          : null,
    };
    const result = await updatePageAction(input);
    setSaving(false);
    if (!result.ok) {
      toast({
        title: "Couldn't save",
        description: result.message,
        variant: "destructive",
      });
      return false;
    }
    if (opts?.publish) setStatus("published");
    // Reset the clean baseline to the just-saved state.
    setSavedSnapshot(snapOf(nextStatus));
    toast({ title: opts?.publish ? "Published" : "Saved" });
    return true;
  }

  // ── Exit flow ─────────────────────────────────────────────────────────
  const PAGES_HREF = "/dashboard/pages";
  function handleExit() {
    if (dirty) setExitOpen(true);
    else router.push(PAGES_HREF);
  }
  async function saveAndExit() {
    const ok = await save();
    if (ok) {
      setExitOpen(false);
      router.push(PAGES_HREF);
    }
  }
  function discardAndExit() {
    setExitOpen(false);
    // Clear the baseline so the beforeunload guard doesn't fire on the push.
    setSavedSnapshot(snapshot);
    router.push(PAGES_HREF);
  }

  return (
    <div className="flex flex-col lg:h-full">
      {/* Two-pane editor. On desktop the whole editor fills the screen height:
          only the LEFT controls column scrolls, while the RIGHT live preview is
          pinned and auto-fits the viewport. On mobile it stacks and scrolls
          normally. Header removed — actions live in the bottom bar. */}
      <div className="grid flex-1 gap-6 p-4 md:p-6 lg:min-h-0 lg:grid-cols-[3fr_7fr]">
      <div className="flex min-w-0 flex-col pb-24 lg:min-h-0 lg:overflow-y-auto lg:pb-2 lg:pr-1">
      <Tabs defaultValue="design" className="min-w-0">
        {/* Step tabs pinned to the top of the scrolling controls column so
            they stay reachable while the fields below scroll. */}
        <div className="sticky top-0 z-20 -mx-1 mb-3 bg-background px-1 pb-2 pt-1">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="design">1 · Design</TabsTrigger>
            <TabsTrigger value="content">2 · Content</TabsTrigger>
            <TabsTrigger value="form">3 · Form</TabsTrigger>
            <TabsTrigger value="conversion">4 · Convert</TabsTrigger>
            <TabsTrigger value="pixels">5 · Pixels</TabsTrigger>
            <TabsTrigger value="settings">6 · Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="content" className="mt-6">
          <Customizer
            templateId={initial.template_id}
            title={title}
            onTitleChange={setTitle}
            slug={slug}
            onSlugChange={setSlug}
            slugLocked
            values={values}
            onValuesChange={setValues}
            pageType={initial.type}
            hideDesign
            hidePreview
          />
        </TabsContent>

        <TabsContent value="design" className="mt-6">
          <DesignTab
            values={values}
            onChange={(patch) => setValues({ ...values, ...patch })}
          />
        </TabsContent>

        <TabsContent value="form" className="mt-6">
          <FormBuilderTab
            pageId={initial.id}
            pageType={initial.type}
            formConfig={(values.form_config as FormConfig) ?? {}}
            leadMagnet={(values.lead_magnet as LeadMagnetMeta) ?? null}
            onFormConfigChange={(next) =>
              setValues({ ...values, form_config: next })
            }
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          {initial.type === "payment" && (
            <PricingCard
              price={price}
              onPrice={setPrice}
              originalPrice={originalPrice}
              onOriginalPrice={setOriginalPrice}
              values={values}
              onValues={setValues}
            />
          )}

          <Card className={initial.type === "payment" ? "mt-6" : undefined}>
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
              <CardDescription>
                What search engines and social previews show.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Meta title</Label>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Defaults to the page title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meta description</Label>
                <Textarea
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="One-line summary for search results"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Favicon</CardTitle>
              <CardDescription>
                The little icon shown in the browser tab. Unique to this page —
                each page can have its own. Use a square PNG (32×32 or larger).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageInput
                value={(values.favicon_url as string) ?? ""}
                onChange={(url) =>
                  setValues({ ...values, favicon_url: url })
                }
                placeholder="Paste an icon URL or upload"
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div>
                  <Label>Published</Label>
                  <p className="text-xs text-muted-foreground">
                    Off = page is a draft.
                  </p>
                </div>
                <Switch
                  checked={status === "published"}
                  onCheckedChange={(on) => setStatus(on ? "published" : "draft")}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Custom domain</CardTitle>
              <CardDescription>
                Available on Pro and Business plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="checkout.yourdomain.com"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pixels" className="mt-6 space-y-4">
          {/* Meta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meta Pixel</CardTitle>
              <CardDescription>
                Inject the Meta pixel on the public page + fire Purchase and
                Lead events. Add a Conversions API access token to also fire
                server-side (more accurate on iOS + ad-blockers).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pixel ID</Label>
                <Input
                  value={pixel.meta_pixel_id}
                  onChange={(e) =>
                    setPixel((p) => ({ ...p, meta_pixel_id: e.target.value }))
                  }
                  placeholder="123456789012345"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CAPI access token (optional)</Label>
                <Input
                  type="password"
                  value={pixel.meta_capi_access_token}
                  onChange={(e) =>
                    setPixel((p) => ({
                      ...p,
                      meta_capi_access_token: e.target.value,
                    }))
                  }
                  placeholder="EAAxxxxx…"
                />
                <p className="text-xs text-muted-foreground">
                  Generated in Meta Events Manager → Settings → Conversions
                  API. We store it server-side and never expose it to the
                  page bundle.
                </p>
              </div>
              <Row label="Fire Purchase event on payment success">
                <Switch
                  checked={pixel.meta_fire_purchase}
                  onCheckedChange={(v) =>
                    setPixel((p) => ({ ...p, meta_fire_purchase: v }))
                  }
                />
              </Row>
              <Row label="Fire Lead event on form submission">
                <Switch
                  checked={pixel.meta_fire_lead}
                  onCheckedChange={(v) =>
                    setPixel((p) => ({ ...p, meta_fire_lead: v }))
                  }
                />
              </Row>
            </CardContent>
          </Card>

          {/* Google */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google Ads</CardTitle>
              <CardDescription>
                Tag ID looks like AW-XXXXXXXXXX. Conversion label is the
                second half after the slash in your Google Ads conversion
                action.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Google Tag ID</Label>
                  <Input
                    value={pixel.google_ads_id}
                    onChange={(e) =>
                      setPixel((p) => ({ ...p, google_ads_id: e.target.value }))
                    }
                    placeholder="AW-123456789"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Conversion label</Label>
                  <Input
                    value={pixel.google_ads_label}
                    onChange={(e) =>
                      setPixel((p) => ({
                        ...p,
                        google_ads_label: e.target.value,
                      }))
                    }
                    placeholder="abcDEFghij1234"
                  />
                </div>
              </div>
              <Row label="Fire conversion on payment success">
                <Switch
                  checked={pixel.google_fire_conversion}
                  onCheckedChange={(v) =>
                    setPixel((p) => ({ ...p, google_fire_conversion: v }))
                  }
                />
              </Row>
            </CardContent>
          </Card>

          {/* TikTok */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">TikTok Pixel</CardTitle>
              <CardDescription>
                Fires PageView automatically and CompletePayment on payment
                success.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pixel ID</Label>
                <Input
                  value={pixel.tiktok_pixel_id}
                  onChange={(e) =>
                    setPixel((p) => ({ ...p, tiktok_pixel_id: e.target.value }))
                  }
                  placeholder="C4XXXXXXXXXXXXXXX"
                />
              </div>
            </CardContent>
          </Card>

          {/* Heatmaps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Heatmaps</CardTitle>
              <CardDescription>
                Hotjar and Microsoft Clarity for session recording + heatmaps.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Hotjar Site ID</Label>
                <Input
                  value={pixel.hotjar_id}
                  onChange={(e) =>
                    setPixel((p) => ({ ...p, hotjar_id: e.target.value }))
                  }
                  placeholder="3123456"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Microsoft Clarity ID</Label>
                <Input
                  value={pixel.clarity_id}
                  onChange={(e) =>
                    setPixel((p) => ({ ...p, clarity_id: e.target.value }))
                  }
                  placeholder="abcdefghi"
                />
              </div>
            </CardContent>
          </Card>

          {/* Custom script — Pro+ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Custom script
                {!customScriptsPlanOk && (
                  <Badge variant="outline" className="ml-2 align-middle">
                    Pro+ only
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Paste a raw &lt;script&gt; block — runs on every visit to
                this page. Use this only for trusted code (your own pixel /
                A/B tool). Anything pasted here runs with the same privileges
                as your site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!customScriptsAllowed && (
                <p className="text-xs text-amber-700">
                  Custom scripts are currently disabled platform-wide by
                  InvoxAI admins.
                </p>
              )}
              <Textarea
                rows={8}
                disabled={!customScriptsAllowed || !customScriptsPlanOk}
                value={pixel.custom_script}
                onChange={(e) =>
                  setPixel((p) => ({ ...p, custom_script: e.target.value }))
                }
                className="font-mono text-xs"
                placeholder="<script>console.log('hello from my page')</script>"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion" className="mt-6">
          <ConversionTab
            countdown={(values.countdown_config as CountdownConfig) ?? {}}
            onCountdownChange={(next) =>
              setValues({ ...values, countdown_config: next })
            }
            exitIntent={(values.exit_intent_config as ExitIntentConfig) ?? {}}
            onExitIntentChange={(next) =>
              setValues({ ...values, exit_intent_config: next })
            }
            bump={(values.order_bump as OrderBumpConfig) ?? {}}
            onBumpChange={(next) => setValues({ ...values, order_bump: next })}
            oto={(values.oto_config as OtoConfig) ?? {}}
            onOtoChange={(next) => setValues({ ...values, oto_config: next })}
            socialProof={
              (values.social_proof_config as
                | import("@/lib/social-proof").SocialProofConfig
                | undefined) ?? {}
            }
            onSocialProofChange={(next) =>
              setValues({ ...values, social_proof_config: next })
            }
            pageId={initial.id ?? null}
            coupons={initial.coupons ?? []}
            products={initial.products ?? []}
          />
        </TabsContent>
      </Tabs>
      </div>

      {/* RIGHT — persistent live preview. Auto-fits the screen height on
          desktop (the column is full-height; the preview fills it). */}
      <div className="min-w-0 lg:min-h-0 lg:h-full">
        <LivePreview
          templateId={initial.template_id}
          values={values}
          title={title}
        />
      </div>
      </div>

      {/* Action bar — Exit + Save + Publish. In-flow at the bottom of the
          full-height editor on desktop (always visible while only the left
          column scrolls); fixed to the viewport bottom on mobile. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 px-3 py-2.5 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4 lg:static lg:z-auto lg:shadow-none lg:backdrop-blur-none">
        <Button variant="ghost" size="sm" onClick={handleExit}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Exit
        </Button>
        {dirty ? (
          <span className="hidden items-center gap-1.5 text-xs font-medium text-amber-600 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved
          </span>
        ) : (
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            {status === "published" ? "Published" : "Draft"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => save()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save changes
          </Button>
          <Button size="sm" onClick={() => save({ publish: true })} disabled={saving}>
            <Rocket className="mr-1.5 h-4 w-4" />
            {status === "published" ? "Update & publish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Exit confirmation — offers Save & exit / Don't save when dirty. */}
      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save changes before leaving?</DialogTitle>
            <DialogDescription>
              You have unsaved edits on this page. Save them, or leave without
              saving — your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setExitOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={discardAndExit}
              disabled={saving}
            >
              Don&apos;t save
            </Button>
            <Button onClick={saveAndExit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save &amp; exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function RupeeField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-muted-foreground">₹</span>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Pricing card (Settings step, payment pages) ───────────────────────────
function PricingCard({
  price,
  onPrice,
  originalPrice,
  onOriginalPrice,
  values,
  onValues,
}: {
  price: string;
  onPrice: (v: string) => void;
  originalPrice: string;
  onOriginalPrice: (v: string) => void;
  values: Record<string, unknown>;
  onValues: (v: Record<string, unknown>) => void;
}) {
  const custom = values.pwyl_enabled === true;
  const presetsText = Array.isArray(values.pwyl_presets)
    ? (values.pwyl_presets as Array<{ amount?: unknown }>)
        .map((p) => Number(p.amount))
        .filter((n) => Number.isFinite(n) && n > 0)
        .join(", ")
    : "";
  const minVal =
    typeof values.pwyl_min === "number" ? String(values.pwyl_min) : "";

  const setCustom = (on: boolean) =>
    onValues({ ...values, pwyl_enabled: on });
  const setMin = (v: string) =>
    onValues({ ...values, pwyl_min: v === "" ? undefined : Number(v) });
  const setPresets = (text: string) => {
    const presets = text
      .split(/[,\s]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((amount) => ({ amount, popular: false }));
    onValues({ ...values, pwyl_presets: presets });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pricing</CardTitle>
        <CardDescription>
          What buyers pay on this page&apos;s checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              {custom ? "Minimum / base price (INR)" : "Offer price (INR)"}
            </Label>
            <RupeeField value={price} onChange={onPrice} placeholder="4999" />
            <p className="text-xs text-muted-foreground">
              {custom
                ? "Buyers can pay this or more — never less."
                : "The amount charged at checkout."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Retail price (INR)</Label>
            <RupeeField
              value={originalPrice}
              onChange={onOriginalPrice}
              placeholder="9999"
            />
            <p className="text-xs text-muted-foreground">
              Optional “compare at” price, shown struck-through. Must be above
              the offer price.
            </p>
          </div>
        </div>

        {/* Price type */}
        <div className="space-y-2">
          <Label>Price type</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCustom(false)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition",
                !custom
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block font-semibold text-foreground">Fixed</span>
              <span className="text-xs">One set price.</span>
            </button>
            <button
              type="button"
              onClick={() => setCustom(true)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition",
                custom
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block font-semibold text-foreground">
                Custom
              </span>
              <span className="text-xs">Pay what you like.</span>
            </button>
          </div>
        </div>

        {/* Custom-price extras */}
        {custom && (
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Minimum amount (INR)</Label>
              <RupeeField
                value={minVal}
                onChange={setMin}
                placeholder={price || "5000"}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the base price above.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Suggested amounts</Label>
              <Input
                value={presetsText}
                onChange={(e) => setPresets(e.target.value)}
                placeholder="5000, 8749, 12499, 21248"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Shown as quick-pick pills.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
