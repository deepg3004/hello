"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  coupons,
  products,
}: ConversionTabProps) {
  const setC = <K extends keyof CountdownConfig>(k: K, v: CountdownConfig[K]) =>
    onCountdownChange({ ...countdown, [k]: v });
  const setE = <K extends keyof ExitIntentConfig>(k: K, v: ExitIntentConfig[K]) =>
    onExitIntentChange({ ...exitIntent, [k]: v });
  const setB = <K extends keyof OrderBumpConfig>(k: K, v: OrderBumpConfig[K]) =>
    onBumpChange({ ...bump, [k]: v });
  const setO = <K extends keyof OtoConfig>(k: K, v: OtoConfig[K]) =>
    onOtoChange({ ...oto, [k]: v });

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
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    value={bump.image_url ?? ""}
                    onChange={(e) => setB("image_url", e.target.value)}
                    placeholder="https://…"
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
                    <SelectItem value="show_form">Embed the opt-in form (coming soon)</SelectItem>
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
    </div>
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
