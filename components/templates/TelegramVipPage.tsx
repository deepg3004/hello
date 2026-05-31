"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Lock, Send, Star, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type { BaseTemplateProps, TemplateProduct } from "./shared/types";

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(days: number | null | undefined): string {
  if (days == null) return "Lifetime";
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return `${years} year${years > 1 ? "s" : ""}`;
  }
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  if (days >= 7 && days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} week${weeks > 1 ? "s" : ""}`;
  }
  return `${days} day${days > 1 ? "s" : ""}`;
}

function tierLabel(p: TemplateProduct): string {
  return p.display_label?.trim() || p.name || formatDuration(p.subscription_days);
}

function tierDurationLabel(p: TemplateProduct): string {
  return `${formatDuration(p.subscription_days)} access`;
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

// ── Types ──────────────────────────────────────────────────────────────

interface Benefit {
  text: string;
}

interface MemberQuote {
  quote: string;
  author: string;
  role?: string;
}

export interface TelegramVipPageProps extends BaseTemplateProps {
  group_name: string;
  group_avatar?: string;
  members_label?: string;
  active_members?: number;
  what_shared?: string;
  benefits_title?: string;
  benefits_items?: Benefit[];
  join_title?: string;
  join_note?: string;
  testimonials_items?: MemberQuote[];
  monthly_join_count?: number;
  description?: string;
  category?: string;
}

// ── Component ──────────────────────────────────────────────────────────

export function TelegramVipPage(props: TelegramVipPageProps) {
  const benefits = props.benefits_items ?? [];
  const sharedItems = (props.what_shared ?? "")
    .split(/[•·\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const testimonials = props.testimonials_items ?? [];

  // Feature list for the "About the offering" panel: prefer structured
  // benefits, then the free-text description (one feature per line), then the
  // "what's shared" chips.
  const features: string[] =
    benefits.length > 0
      ? benefits.map((b) => b.text)
      : (props.description ?? "")
          .split(/\n+/g)
          .map((s) => s.replace(/^[-•✅⭐📌\s]+/, "").trim())
          .filter(Boolean)
          .slice(0, 10);
  const featureList = features.length > 0 ? features : sharedItems;

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(600);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const inv = sp.get("invite");
    if (inv) setInviteLink(inv);
  }, []);

  useEffect(() => {
    if (!inviteLink) return;
    const id = setInterval(() => {
      setInviteSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [inviteLink]);

  const tiers = useMemo<TemplateProduct[]>(() => {
    if (props.products && props.products.length > 0) return props.products;
    return props.product ? [props.product] : [];
  }, [props.products, props.product]);

  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    tiers[0]?.id ?? null,
  );
  useEffect(() => {
    if (!selectedTierId && tiers[0]?.id) setSelectedTierId(tiers[0].id);
    else if (selectedTierId && !tiers.find((t) => t.id === selectedTierId)) {
      setSelectedTierId(tiers[0]?.id ?? null);
    }
  }, [tiers, selectedTierId]);

  const selectedTier =
    tiers.find((t) => t.id === selectedTierId) ?? tiers[0] ?? null;
  const price = selectedTier?.price ?? 0;
  const stickyPriceLabel = price ? inr(price) : "Join";

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, #4c1d95 0%, #2e1065 45%, #1a0733 100%)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ============ LEFT — About the offering ============ */}
          <div className="rounded-2xl border border-white/10 bg-[#15151f] p-6 text-zinc-100 shadow-2xl md:p-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              About the offering
            </h2>
            <p className="mt-2 font-sora text-2xl font-bold text-white">
              {props.group_name}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {props.category && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                  {props.category}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                ⚡ {tiers.length} {tiers.length === 1 ? "Plan" : "Plans"}
              </span>
              {props.active_members != null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <Users className="h-3 w-3" />
                  {props.active_members.toLocaleString("en-IN")} members
                </span>
              )}
            </div>

            {featureList.length > 0 && (
              <ul className="mt-6 space-y-3">
                {featureList.slice(0, 10).map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-zinc-500">
              <span className="font-semibold text-zinc-400">Disclaimer:</span> This
              offering is provided by the creator, not InvoxAI. Content is for
              educational/informational purposes only and is not financial advice.
              Payments are processed securely; access is granted per the plan you
              choose.
            </div>
          </div>

          {/* ============ RIGHT — product + plans + checkout ============ */}
          <div
            id="join"
            className="scroll-mt-16 rounded-2xl border border-white/10 bg-[#15151f] p-6 text-zinc-100 shadow-2xl md:p-8"
          >
            {inviteLink ? (
              <InviteLinkCard
                groupName={props.group_name}
                link={inviteLink}
                secondsLeft={inviteSecondsLeft}
              />
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[#0088cc]/60 bg-[#0088cc] text-white shadow-lg">
                    {props.group_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={props.group_avatar} alt={props.group_name} className="h-full w-full object-cover" />
                    ) : (
                      <Send className="h-9 w-9 -translate-x-0.5" />
                    )}
                  </div>
                  <h1 className="mt-4 font-sora text-2xl font-bold text-white">
                    {props.group_name}
                  </h1>
                </div>

                {/* Plan options */}
                <div className="mt-6 space-y-3">
                  {tiers.map((tier) => {
                    const isSel = tier.id === selectedTierId;
                    const orig = tier.original_price ?? 0;
                    const off = orig > tier.price ? Math.round((1 - tier.price / orig) * 100) : 0;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTierId(tier.id)}
                        className={[
                          "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition",
                          isSel
                            ? "border-[#0088cc] bg-[#0088cc]/15 ring-2 ring-[#0088cc]/30"
                            : "border-white/10 bg-white/5 hover:border-white/30",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{tierLabel(tier)}</span>
                            {off > 0 && (
                              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                {off}% OFF
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/60">{tierDurationLabel(tier)}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          {orig > tier.price && (
                            <div className="text-xs text-white/40 line-through">{inr(orig)}</div>
                          )}
                          <div className="font-sora text-lg font-bold text-white">{inr(tier.price)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Checkout for the selected plan */}
                <div className="mt-5 rounded-xl bg-white p-4 text-zinc-900">
                  {props.pageId && selectedTier && !props.isPreview ? (
                    <CheckoutForm
                      key={selectedTier.id}
                      pageId={props.pageId}
                      productId={selectedTier.id}
                      productName={selectedTier.name}
                      productDescription={selectedTier.description}
                      productImage={selectedTier.image_url}
                      price={Number(selectedTier.price)}
                      currency={selectedTier.currency}
                      orderBump={
                        props.bumpRuntime ? { ...props.bumpRuntime, ready: true } : undefined
                      }
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                      {props.isPreview
                        ? "Checkout form renders on the live page."
                        : "Attach a product to this page to enable checkout."}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ============ Secure-payment footer ============ */}
        <div className="mt-8 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-300">
            <Lock className="h-4 w-4" />
            Guaranteed safe &amp; secure payment
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {["UPI", "Google Pay", "Paytm", "Visa", "Mastercard", "RuPay"].map((m) => (
              <span
                key={m}
                className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-200"
              >
                {m}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">Powered by InvoxAI · Razorpay secured</p>
        </div>

        {/* Optional social proof (only if the seller set testimonials) */}
        {(testimonials.length > 0 || props.monthly_join_count) && (
          <div className="mt-10">
            {props.monthly_join_count != null && props.monthly_join_count > 0 && (
              <RecentMembersStrip count={props.monthly_join_count} />
            )}
            {testimonials.length > 0 && (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {testimonials.slice(0, 4).map((t, i) => (
                  <figure key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5" fill="currentColor" />
                      ))}
                    </div>
                    <blockquote className="mt-3 text-sm leading-relaxed text-white/90">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-zinc-950">
                        {initials(t.author)}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">{t.author}</div>
                        {t.role && <div className="text-xs text-white/60">{t.role}</div>}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <StickyCheckoutBar
        targetId="join"
        priceLabel={stickyPriceLabel}
        cta="Join Group"
        buttonClassName="bg-[#0088cc] text-white"
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function InviteLinkCard({
  groupName,
  link,
  secondsLeft,
}: {
  groupName: string;
  link: string;
  secondsLeft: number;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const mmss = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border-2 border-emerald-400/40 bg-white p-6 text-zinc-900">
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <p className="font-sora text-lg font-bold tracking-tight text-emerald-700">
          Payment confirmed 🎉
        </p>
      </div>
      <p className="mt-2 text-center text-sm text-zinc-600">
        Your invite link is ready! Click below to join the group.
      </p>
      <Button
        asChild
        className="mt-5 w-full bg-[#0088cc] py-6 text-base font-semibold text-white hover:bg-[#0099e0]"
      >
        <a href={link} target="_blank" rel="noreferrer">
          <Send className="mr-2 h-4 w-4" />
          Join {groupName} Now
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </Button>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-semibold",
            secondsLeft <= 60 ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          ⏳ Link expires in {mmss}
        </span>
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-500">
        Link sent to your email too — check your inbox just in case.
      </p>
    </div>
  );
}

function RecentMembersStrip({ count }: { count: number }) {
  const palette = [
    "from-amber-500 to-orange-600",
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600",
  ];
  const inits = ["PS", "RK", "AM", "JT", "SN", "VG"];
  return (
    <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
      <div className="flex -space-x-2">
        {inits.map((init, i) => (
          <span
            key={i}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full",
              "border-2 border-[#1a0733] bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
              palette[i % palette.length] ?? "from-sky-500 to-blue-600",
            ].join(" ")}
            style={{ zIndex: 10 - i }}
          >
            {init}
          </span>
        ))}
      </div>
      <span className="text-sm text-white/80">
        <span className="font-bold text-amber-300">{count.toLocaleString("en-IN")}</span> members
        joined this month
      </span>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
