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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Customizer } from "./Customizer";
import { FormBuilderTab } from "./FormBuilderTab";
import { useToast } from "@/hooks/use-toast";
import { updatePageAction, type UpdatePageInput } from "@/actions/pages";
import type { FormConfig, LeadMagnetMeta } from "@/lib/leads";

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
    google_ads_id: string | null;
    google_ads_label: string | null;
    tiktok_pixel_id: string | null;
    hotjar_id: string | null;
  } | null;
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
  const [pixel, setPixel] = useState({
    meta_pixel_id: initial.pixel?.meta_pixel_id ?? "",
    google_ads_id: initial.pixel?.google_ads_id ?? "",
    google_ads_label: initial.pixel?.google_ads_label ?? "",
    tiktok_pixel_id: initial.pixel?.tiktok_pixel_id ?? "",
    hotjar_id: initial.pixel?.hotjar_id ?? "",
  });

  const [saving, setSaving] = useState(false);

  async function save() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Edit page</h1>
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <span className="font-medium">
              {status === "published" ? "Published" : status === "draft" ? "Draft" : status}
            </span>
            {status === "published" && (
              <>
                {" · "}
                <a
                  href={`/p/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  /p/{slug}
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

        <TabsContent value="pixels" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ads tracking</CardTitle>
              <CardDescription>
                Add pixel IDs and they&apos;ll be injected on the live page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Meta Pixel ID</Label>
                <Input
                  value={pixel.meta_pixel_id}
                  onChange={(e) =>
                    setPixel((p) => ({ ...p, meta_pixel_id: e.target.value }))
                  }
                  placeholder="123456789012345"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Google Ads ID</Label>
                  <Input
                    value={pixel.google_ads_id}
                    onChange={(e) =>
                      setPixel((p) => ({ ...p, google_ads_id: e.target.value }))
                    }
                    placeholder="AW-123456789"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Google Ads conversion label</Label>
                  <Input
                    value={pixel.google_ads_label}
                    onChange={(e) =>
                      setPixel((p) => ({ ...p, google_ads_label: e.target.value }))
                    }
                    placeholder="abcDEFghij1234"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>TikTok Pixel ID</Label>
                <Input
                  value={pixel.tiktok_pixel_id}
                  onChange={(e) =>
                    setPixel((p) => ({ ...p, tiktok_pixel_id: e.target.value }))
                  }
                  placeholder="C4XXXXXXXXXXXXXXX"
                />
              </div>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion boosters</CardTitle>
              <CardDescription>
                Coupons, upsells and countdown timers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon — manage coupons under{" "}
                <a className="underline" href="/dashboard">/dashboard</a> in the
                meantime.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
