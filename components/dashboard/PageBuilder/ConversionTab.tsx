"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImageInput } from "@/components/ui/ImageInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  CountdownConfig,
  CountdownExpiryBehavior,
  CountdownPosition,
  ExitIntentAction,
  ExitIntentConfig,
} from "@/lib/conversion";
import { COUNTDOWN_DEFAULTS, EXIT_INTENT_DEFAULTS } from "@/lib/conversion";
import type { OrderBumpConfig, OtoConfig } from "@/lib/upsells";
import { ORDER_BUMP_DEFAULTS, OTO_DEFAULTS } from "@/lib/upsells";
import { Textarea as TA } from "@/components/ui/textarea";
import type { SocialProofConfig } from "@/lib/social-proof";
import { SOCIAL_PROOF_DEFAULTS } from "@/lib/social-proof";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Tag, Wand2 } from "lucide-react";
import { seedSocialProofAction } from "@/actions/social-proof";
import {
  createCouponAction,
  generateCouponCodeAction,
} from "@/actions/coupons";
import { useToast } from "@/hooks/use-toast";

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface ConversionTabProps {
  countdown: CountdownConfig;
  onCountdownChange: (next: CountdownConfig) => void;
  exitIntent: ExitIntentConfig;
  onExitIntentChange: (next: ExitIntentConfig) => void;
  bump: OrderBumpConfig;
  onBumpChange: (next: OrderBumpConfig) => void;
  oto: OtoConfig;
  onOtoChange: (next: OtoConfig) => void;
  socialProof: SocialProofConfig;
  onSocialProofChange: (next: SocialProofConfig) => void;
  /** Required for the "Seed sample events" action — null on /new pages. */
  pageId: string | null;
  coupons: Array<{ code: string }>;
  products: ProductOption[];
}

export function ConversionTab({
  countdown,
  onCountdownChange,
  exitIntent,
  onExitIntentChange,
  bump,
  onBumpChange,
  oto,
  onOtoChange,
  socialProof,
  onSocialProofChange,
  pageId,
  coupons,
  products,
}: ConversionTabProps) {
  const { toast } = useToast();
  const [seeding, startSeeding] = useTransition();
  const setC = <K extends keyof CountdownConfig>(k: K, v: CountdownConfig[K]) =>
    onCountdownChange({ ...countdown, [k]: v });
  const setE = <K extends keyof ExitIntentConfig>(k: K, v: ExitIntentConfig[K]) =>
    onExitIntentChange({ ...exitIntent, [k]: v });
  const setB = <K extends keyof OrderBumpConfig>(k: K, v: OrderBumpConfig[K]) =>
    onBumpChange({ ...bump, [k]: v });
  const setO = <K extends keyof OtoConfig>(k: K, v: OtoConfig[K]) =>
    onOtoChange({ ...oto, [k]: v });
  const setSP = <K extends keyof SocialProofConfig>(
    k: K,
    v: SocialProofConfig[K],
  ) => onSocialProofChange({ ...socialProof, [k]: v });

  function seedNow() {
    if (!pageId) {
      toast({
        title: "Save the page first",
        description:
          "Once the page is saved we can seed sample events for the widget.",
      });
      return;
    }
    const n = socialProof.seed_count ?? SOCIAL_PROOF_DEFAULTS.seed_count;
    if (n < 1 || n > 10) {
      toast({
        variant: "destructive",
        title: "Pick 1–10",
        description: "Choose between 1 and 10 seed events.",
      });
      return;
    }
    startSeeding(async () => {
      const res = await seedSocialProofAction({ page_id: pageId, count: n });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't seed",
          description: res.message,
        });
        return;
      }
      toast({
        title: "Seeded",
        description: `${res.inserted} sample event${res.inserted === 1 ? "" : "s"} added.`,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* ===== Countdown ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Countdown timer</CardTitle>
          <CardDescription>
            Sticky bar at the top of the page. Choose a fixed end date or an
            evergreen timer (resets per visitor).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Enable countdown">
            <Switch
              checked={!!countdown.enabled}
              onCheckedChange={(v) => setC("enabled", v)}
            />
          </Row>

          {countdown.enabled && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={countdown.type ?? "fixed"}
                  onValueChange={(v) => setC("type", v as "fixed" | "evergreen")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed end date</SelectItem>
                    <SelectItem value="evergreen">Evergreen (per-visitor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {countdown.type === "fixed" ? (
                <div>
                  <Label className="text-xs">Ends at</Label>
                  <Input
                    type="datetime-local"
                    value={
                      countdown.target
                        ? new Date(countdown.target).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setC(
                        "target",
                        e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      )
                    }
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Duration (hours)</Label>
                  <Input
                    type="number"
                    value={countdown.duration_hours ?? COUNTDOWN_DEFAULTS.duration_hours}
                    onChange={(e) => setC("duration_hours", Number(e.target.value))}
                    min={1}
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={countdown.label ?? COUNTDOWN_DEFAULTS.label}
                  onChange={(e) => setC("label", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Background colour</Label>
                  <Input
                    type="color"
                    value={countdown.bg_color ?? COUNTDOWN_DEFAULTS.bg_color}
                    onChange={(e) => setC("bg_color", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Text colour</Label>
                  <Input
                    type="color"
                    value={countdown.text_color ?? COUNTDOWN_DEFAULTS.text_color}
                    onChange={(e) => setC("text_color", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Position</Label>
                <Select
                  value={countdown.position ?? COUNTDOWN_DEFAULTS.position}
                  onValueChange={(v) => setC("position", v as CountdownPosition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sticky_top">Sticky top bar</SelectItem>
                    <SelectItem value="above_cta">Above CTA (template-defined)</SelectItem>
                    <SelectItem value="hidden">Don&apos;t render</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">When it expires</Label>
                <Select
                  value={countdown.expiry_behavior ?? COUNTDOWN_DEFAULTS.expiry_behavior}
                  onValueChange={(v) =>
                    setC("expiry_behavior", v as CountdownExpiryBehavior)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hide">Hide the timer</SelectItem>
                    <SelectItem value="show_expired">Show &quot;Offer expired&quot;</SelectItem>
                    <SelectItem value="redirect">Redirect to a URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {countdown.expiry_behavior === "redirect" && (
                <div>
                  <Label className="text-xs">Redirect URL</Label>
                  <Input
                    value={countdown.expiry_redirect_url ?? ""}
                    onChange={(e) => setC("expiry_redirect_url", e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              )}
              {countdown.expiry_behavior === "show_expired" && (
                <div>
                  <Label className="text-xs">Expiry message</Label>
                  <Input
                    value={countdown.expiry_text ?? ""}
                    onChange={(e) => setC("expiry_text", e.target.value)}
                    placeholder="Sorry — this offer is over."
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Order bump ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order bump</CardTitle>
          <CardDescription>
            A second product offered as a checkbox on the checkout page. Buyer
            ticks it and the total updates instantly — single Razorpay charge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Enable order bump">
            <Switch checked={!!bump.enabled} onCheckedChange={(v) => setB("enabled", v)} />
          </Row>

          {bump.enabled && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">Bump product</Label>
                <Select
                  value={bump.product_id ?? ""}
                  onValueChange={(v) => {
                    const p = products.find((x) => x.id === v);
                    setB("product_id", v || undefined);
                    if (p && bump.price == null) setB("price", p.price);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Create products under /dashboard/pages first.
                      </SelectItem>
                    ) : (
                      products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · ₹{p.price.toLocaleString("en-IN")}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Bump price (INR)</Label>
                  <Input
                    type="number"
                    value={bump.price ?? ""}
                    onChange={(e) => setB("price", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="Defaults to product price"
                  />
                </div>
                <div>
                  <Label className="text-xs">“Was” price (optional)</Label>
                  <Input
                    type="number"
                    value={bump.original_price ?? ""}
                    onChange={(e) => setB("original_price", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="Shows a strike-through + % off"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bump image</Label>
                  <ImageInput
                    value={bump.image_url ?? ""}
                    onChange={(url) => setB("image_url", url)}
                    placeholder="Paste an image URL or upload"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Title (rendered as the checkbox label)</Label>
                <Input
                  value={bump.title ?? ORDER_BUMP_DEFAULTS.title}
                  onChange={(e) => setB("title", e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <TA
                  rows={2}
                  value={bump.description ?? ORDER_BUMP_DEFAULTS.description}
                  onChange={(e) => setB("description", e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== OTO ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">One-time offer (OTO)</CardTitle>
          <CardDescription>
            Shown after a successful purchase, on a dedicated page. The buyer
            sees it once — accept charges a second Razorpay transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Enable OTO">
            <Switch checked={!!oto.enabled} onCheckedChange={(v) => setO("enabled", v)} />
          </Row>

          {oto.enabled && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">OTO product</Label>
                <Select
                  value={oto.product_id ?? ""}
                  onValueChange={(v) => {
                    const p = products.find((x) => x.id === v);
                    setO("product_id", v || undefined);
                    if (p && oto.price == null) setO("price", p.price);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No products yet.
                      </SelectItem>
                    ) : (
                      products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · ₹{p.price.toLocaleString("en-IN")}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">OTO price (INR)</Label>
                  <Input
                    type="number"
                    value={oto.price ?? ""}
                    onChange={(e) => setO("price", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    value={oto.image_url ?? ""}
                    onChange={(e) => setO("image_url", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Headline</Label>
                <Input
                  value={oto.headline ?? OTO_DEFAULTS.headline}
                  onChange={(e) => setO("headline", e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <TA
                  rows={3}
                  value={oto.description ?? OTO_DEFAULTS.description}
                  onChange={(e) => setO("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CTA text (accept)</Label>
                  <Input
                    value={oto.cta_text ?? OTO_DEFAULTS.cta_text}
                    onChange={(e) => setO("cta_text", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Decline link text</Label>
                  <Input
                    value={oto.decline_text ?? OTO_DEFAULTS.decline_text}
                    onChange={(e) => setO("decline_text", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Exit intent ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exit intent popup</CardTitle>
          <CardDescription>
            Fires when the visitor moves their cursor toward the browser
            chrome (desktop) or scrolls quickly back to the top (mobile).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Enable exit intent">
            <Switch
              checked={!!exitIntent.enabled}
              onCheckedChange={(v) => setE("enabled", v)}
            />
          </Row>

          {exitIntent.enabled && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">Action</Label>
                <Select
                  value={exitIntent.action ?? EXIT_INTENT_DEFAULTS.action}
                  onValueChange={(v) => setE("action", v as ExitIntentAction)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show_coupon">Show a coupon code</SelectItem>
                    <SelectItem value="show_message">Show a message + CTA</SelectItem>
                    {/* show_form embed isn't implemented yet — hidden so a seller
                        can't ship an empty popup. Re-add when the form embed lands. */}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Headline</Label>
                <Input
                  value={exitIntent.headline ?? EXIT_INTENT_DEFAULTS.headline}
                  onChange={(e) => setE("headline", e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Body</Label>
                <Textarea
                  rows={2}
                  value={exitIntent.body ?? EXIT_INTENT_DEFAULTS.body}
                  onChange={(e) => setE("body", e.target.value)}
                />
              </div>

              {exitIntent.action === "show_coupon" && (
                <>
                  <div>
                    <Label className="text-xs">Coupon code</Label>
                    {coupons.length === 0 ? (
                      <Input
                        value={exitIntent.coupon_code ?? ""}
                        onChange={(e) => setE("coupon_code", e.target.value.toUpperCase())}
                        placeholder="WELCOME10"
                        className="font-mono uppercase"
                      />
                    ) : (
                      <Select
                        value={exitIntent.coupon_code ?? ""}
                        onValueChange={(v) => setE("coupon_code", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a coupon" />
                        </SelectTrigger>
                        <SelectContent>
                          {coupons.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Description under the code</Label>
                    <Input
                      value={exitIntent.coupon_description ?? ""}
                      onChange={(e) => setE("coupon_description", e.target.value)}
                      placeholder="Save 10% — code expires today."
                    />
                  </div>
                </>
              )}

              {exitIntent.action === "show_message" && (
                <>
                  <div>
                    <Label className="text-xs">CTA button text</Label>
                    <Input
                      value={exitIntent.cta_text ?? EXIT_INTENT_DEFAULTS.cta_text}
                      onChange={(e) => setE("cta_text", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CTA URL</Label>
                    <Input
                      value={exitIntent.cta_url ?? ""}
                      onChange={(e) => setE("cta_url", e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Min seconds on page</Label>
                  <Input
                    type="number"
                    value={exitIntent.min_time_seconds ?? EXIT_INTENT_DEFAULTS.min_time_seconds}
                    onChange={(e) => setE("min_time_seconds", Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div>
                  <Label className="text-xs">Suppress after dismiss (hours)</Label>
                  <Input
                    type="number"
                    value={exitIntent.suppress_hours ?? EXIT_INTENT_DEFAULTS.suppress_hours}
                    onChange={(e) => setE("suppress_hours", Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Social proof ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social proof</CardTitle>
          <CardDescription>
            Recent-buyer popup + a live buyer-count badge. Both pull from the
            real /api/social-proof feed for this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recent-buyer popup */}
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <Row label="Recent-buyer popup">
              <Switch
                checked={!!socialProof.popup_enabled}
                onCheckedChange={(v) => setSP("popup_enabled", v)}
              />
            </Row>
            {socialProof.popup_enabled && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Delay between popups (sec)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={60}
                    value={
                      socialProof.popup_delay_seconds ??
                      SOCIAL_PROOF_DEFAULTS.popup_delay_seconds
                    }
                    onChange={(e) =>
                      setSP("popup_delay_seconds", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Display duration (sec)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={10}
                    value={
                      socialProof.popup_duration_seconds ??
                      SOCIAL_PROOF_DEFAULTS.popup_duration_seconds
                    }
                    onChange={(e) =>
                      setSP("popup_duration_seconds", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Position</Label>
                  <Select
                    value={
                      socialProof.popup_position ??
                      SOCIAL_PROOF_DEFAULTS.popup_position
                    }
                    onValueChange={(v) =>
                      setSP(
                        "popup_position",
                        v as "bottom-left" | "bottom-right",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-left">Bottom-left</SelectItem>
                      <SelectItem value="bottom-right">Bottom-right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Buyer-count badge */}
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <Row label="Buyer-count badge">
              <Switch
                checked={!!socialProof.badge_enabled}
                onCheckedChange={(v) => setSP("badge_enabled", v)}
              />
            </Row>
            {socialProof.badge_enabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Count type</Label>
                  <Select
                    value={
                      socialProof.badge_count_type ??
                      SOCIAL_PROOF_DEFAULTS.badge_count_type
                    }
                    onValueChange={(v) =>
                      setSP(
                        "badge_count_type",
                        v as "total" | "today" | "week",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">All-time total</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Label text</Label>
                  <Input
                    value={
                      socialProof.badge_label_text ??
                      SOCIAL_PROOF_DEFAULTS.badge_label_text
                    }
                    onChange={(e) =>
                      setSP("badge_label_text", e.target.value)
                    }
                    placeholder="people bought this"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Seed initial data */}
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Seed initial entries</p>
              <p className="text-xs text-muted-foreground">
                Brand-new pages have no real buyers yet. Generate 1–10 fake
                purchases so the widgets aren&apos;t empty on launch day. Seed
                rows are tagged{" "}
                <code className="rounded bg-muted px-1">is_seed=true</code>{" "}
                in the DB so you can identify them later.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label className="text-xs">How many?</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={socialProof.seed_count ?? 5}
                  onChange={(e) =>
                    setSP("seed_count", Number(e.target.value))
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={seedNow}
                disabled={seeding || !pageId}
              >
                {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Seed sample events
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick coupon creation — scoped to this page. */}
      <CouponQuickAdd pageId={pageId} existing={coupons} />
    </div>
  );
}

function CouponQuickAdd({
  pageId,
  existing,
}: {
  pageId: string | null;
  existing: Array<{ code: string }>;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const create = () => {
    if (!pageId) {
      toast({ title: "Save the page first", variant: "destructive" });
      return;
    }
    const cleaned = code.trim().toUpperCase();
    const num = Number(value);
    if (cleaned.length < 3) {
      toast({ title: "Enter a code (3+ chars)", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(num) || num <= 0) {
      toast({ title: "Enter a discount value", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await createCouponAction({
        code: cleaned,
        discount_type: type,
        discount_value: num,
        min_order: 0,
        max_discount: null,
        total_limit: null,
        per_customer_limit: 1,
        starts_at: null,
        expires_at: null,
        page_ids: [pageId],
        active: true,
        show_at_checkout: false,
      });
      if (!res.ok) {
        toast({ title: "Couldn't create coupon", description: res.message, variant: "destructive" });
        return;
      }
      setCreated((c) => [cleaned, ...c]);
      setCode("");
      setValue("");
      toast({ title: `Coupon ${cleaned} created` });
    });
  };

  const allCodes = [...created, ...existing.map((c) => c.code)];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coupons</CardTitle>
        <CardDescription>
          Add a discount code that works on this page&apos;s checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs">Code</Label>
            <div className="flex gap-1">
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                }
                placeholder="SAVE20"
                className="font-mono uppercase"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate a code"
                onClick={async () => {
                  const r = await generateCouponCodeAction();
                  setCode(r.code);
                }}
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "percentage" | "fixed")}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">% off</SelectItem>
                <SelectItem value="fixed">₹ off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{type === "percentage" ? "Percent" : "Amount (₹)"}</Label>
            <Input
              type="number"
              min="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percentage" ? "20" : "500"}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={create} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </div>
        </div>

        {allCodes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allCodes.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 font-mono text-xs"
              >
                <Tag className="h-3 w-3" />
                {c}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          New coupons apply to this page. Manage all coupons (limits, expiry) in
          the Coupons section.
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
