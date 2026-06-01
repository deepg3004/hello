"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Customizer } from "./Customizer";
import { FormBuilderTab } from "./FormBuilderTab";
import { ConversionTab } from "./ConversionTab";
import { useToast } from "@/hooks/use-toast";
import { updatePageAction, type UpdatePageInput } from "@/actions/pages";
import { publicPagePath } from "@/lib/page-url";
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
  // Price seeded from the most recently created products row (the same one
  // the public page renders). Empty string when no product exists yet — the
  // Customizer's Price field will let the seller set one.
  const initialPrice =
    (initial.products?.[0]?.price ?? 0) > 0
      ? String(initial.products![0].price)
      : "";
  const [price, setPrice] = useState<string>(initialPrice);
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

  async function save() {
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
      return;
    }
    setSaving(true);
    const input: UpdatePageInput = {
      id: initial.id,
      title,
      slug,
      values,
      status,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      custom_domain: customDomain || null,
      pixel,
      price: parsedPrice,
    };
    const result = await updatePageAction(input);
    setSaving(false);
    if (!result.ok) {
      toast({
        title: "Couldn't save",
        description: result.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Saved" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sora font-semibold tracking-tight">Edit page</h1>
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <span className="font-medium">
              {status === "published" ? "Published" : status === "draft" ? "Draft" : status}
            </span>
            {status === "published" && (
              <>
                {" · "}
                <a
                  href={publicPagePath(initial.type, slug, initial.template_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {publicPagePath(initial.type, slug, initial.template_id)}
                </a>
              </>
            )}
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="pixels">Pixels</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
        </TabsList>

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
            price={price}
            onPriceChange={setPrice}
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
          <Card>
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
