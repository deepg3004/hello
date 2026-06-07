"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import {
  createCouponAction,
  generateCouponCodeAction,
  updateCouponAction,
  type CouponInput,
} from "@/actions/coupons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";

export interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: Array<{ id: string; title: string }>;
  /** Pass to edit an existing row. Omit to create a new one. */
  initial?: {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    min_order: number;
    max_discount: number | null;
    total_limit: number | null;
    per_customer_limit: number;
    starts_at: string | null;
    expires_at: string | null;
    page_ids: string[];
    active: boolean;
    show_at_checkout: boolean;
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function CouponDialog({ open, onOpenChange, pages, initial }: CouponDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = !!initial;

  const [code, setCode] = useState(initial?.code ?? "");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    initial?.discount_type ?? "percentage",
  );
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value ?? 10));
  const [minOrder, setMinOrder] = useState(String(initial?.min_order ?? 0));
  const [maxDiscount, setMaxDiscount] = useState(
    initial?.max_discount != null ? String(initial.max_discount) : "",
  );
  const [totalLimit, setTotalLimit] = useState(
    initial?.total_limit != null ? String(initial.total_limit) : "",
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    String(initial?.per_customer_limit ?? 1),
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at ?? null));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(initial?.expires_at ?? null));
  const [active, setActive] = useState(initial?.active ?? true);
  const [showAtCheckout, setShowAtCheckout] = useState(initial?.show_at_checkout ?? false);
  const [allPages, setAllPages] = useState((initial?.page_ids?.length ?? 0) === 0);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(
    new Set(initial?.page_ids ?? []),
  );

  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Reset when reopening for a different row.
  useEffect(() => {
    if (open && initial) {
      setCode(initial.code);
      setDiscountType(initial.discount_type);
      setDiscountValue(String(initial.discount_value));
      setMinOrder(String(initial.min_order));
      setMaxDiscount(initial.max_discount != null ? String(initial.max_discount) : "");
      setTotalLimit(initial.total_limit != null ? String(initial.total_limit) : "");
      setPerCustomerLimit(String(initial.per_customer_limit));
      setStartsAt(toLocalInput(initial.starts_at));
      setExpiresAt(toLocalInput(initial.expires_at));
      setActive(initial.active);
      setShowAtCheckout(initial.show_at_checkout ?? false);
      setAllPages((initial.page_ids?.length ?? 0) === 0);
      setSelectedPages(new Set(initial.page_ids ?? []));
    }
  }, [open, initial]);

  async function autogen() {
    setGenerating(true);
    const r = await generateCouponCodeAction();
    setGenerating(false);
    setCode(r.code);
  }

  async function save() {
    const payload: CouponInput = {
      code,
      discount_type: discountType,
      discount_value: Number(discountValue),
      min_order: Number(minOrder),
      max_discount: maxDiscount === "" ? null : Number(maxDiscount),
      total_limit: totalLimit === "" ? null : Number(totalLimit),
      per_customer_limit: Number(perCustomerLimit),
      starts_at: fromLocalInput(startsAt),
      expires_at: fromLocalInput(expiresAt),
      page_ids: allPages ? [] : Array.from(selectedPages),
      active,
      show_at_checkout: showAtCheckout,
    };
    setSubmitting(true);
    const r = editing
      ? await updateCouponAction(initial!.id, payload)
      : await createCouponAction(payload);
    setSubmitting(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Coupon updated" : "Coupon created" });
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          <DialogDescription>
            Discounts apply at checkout. Each customer can use a coupon up to{" "}
            <strong>per_customer_limit</strong> times.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="font-mono uppercase"
              />
              <Button type="button" variant="outline" onClick={autogen} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Discount type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percentage" | "fixed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed (INR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                min={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min order (INR)</Label>
              <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} min={0} />
            </div>
            <div>
              <Label className="text-xs">Max discount (INR)</Label>
              <Input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder="No cap"
                disabled={discountType !== "percentage"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Total uses</Label>
              <Input
                type="number"
                value={totalLimit}
                onChange={(e) => setTotalLimit(e.target.value)}
                placeholder="Unlimited"
                min={1}
              />
            </div>
            <div>
              <Label className="text-xs">Per customer</Label>
              <Input
                type="number"
                value={perCustomerLimit}
                onChange={(e) => setPerCustomerLimit(e.target.value)}
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Starts at (optional)</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Checkbox checked={allPages} onCheckedChange={(v) => setAllPages(!!v)} />
              <Label className="cursor-pointer text-sm">Apply to all pages</Label>
            </div>
            {!allPages && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                {pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No pages yet.</p>
                ) : (
                  pages.map((p) => {
                    const on = selectedPages.has(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedPages);
                            if (v) next.add(p.id);
                            else next.delete(p.id);
                            setSelectedPages(next);
                          }}
                        />
                        {p.title}
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">
                Off = the code is rejected at checkout.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div>
              <Label>Show at checkout</Label>
              <p className="text-xs text-muted-foreground">
                Publicly list this code so buyers can tap to apply it. Leave off
                to keep it secret (only people with the code can use it).
              </p>
            </div>
            <Switch checked={showAtCheckout} onCheckedChange={setShowAtCheckout} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
