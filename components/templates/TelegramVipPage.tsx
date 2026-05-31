"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Lock, Send, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BgAnimation } from "./BgAnimation";
import { tgTheme } from "@/lib/telegram-themes";
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
  offer_ends_at?: string | null;
  /** Theme key (see lib/telegram-themes). Defaults to "purple". */
  theme_key?: string;
  /** Background animation: none | snow | gift | party | space | planet. */
  bg_animation?: string;
}

// ── Component ──────────────────────────────────────────────────────────

export function TelegramVipPage(props: TelegramVipPageProps) {
  const benefits = props.benefits_items ?? [];
  const sharedItems = (props.what_shared ?? "")
    .split(/[•·\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const testimonials = props.testimonials_items ?? [];
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;

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

  // Carry a coupon from /p/<slug>?coupon=CODE into the dedicated checkout page.
  const [couponParam, setCouponParam] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = new URLSearchParams(window.location.search).get("coupon");
    if (c) setCouponParam(c);
  }, []);
  const checkoutHref = (id: string) =>
    `/p/${props.slug ?? ""}/checkout?product=${id}${
      couponParam ? `&coupon=${encodeURIComponent(couponParam)}` : ""
    }`;

  // Mobile: plans live in a bottom sheet opened from the fixed bottom bar.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileChosen, setMobileChosen] = useState(false);

  return (
    <div className="relative min-h-screen" style={{ background: theme.bg }}>
      <BgAnimation type={props.bg_animation} />
      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-28 pt-10 md:pb-14 md:pt-14">
        {/* Mobile header — creator avatar + name */}
        <div className="mb-4 flex items-center gap-3 lg:hidden">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-white"
            style={{ backgroundColor: accent, borderColor: `${accent}99` }}
          >
            {props.group_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.group_avatar} alt={props.group_name} className="h-full w-full object-cover" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-sora font-semibold text-white">{props.group_name}</div>
            <div className="text-[11px] text-white/60">
              {props.category ? `${props.category} · ` : ""}
              {tiers.length} {tiers.length === 1 ? "plan" : "plans"}
            </div>
          </div>
        </div>

        {props.offer_ends_at && <OfferCountdown endsAt={props.offer_ends_at} accent={accent} />}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ============ LEFT — About the offering ============ */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-zinc-100 shadow-2xl md:p-8">
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
          {/* On mobile this is hidden (the fixed bottom bar + plan sheet take
              over); the invite-success card still shows on every size. */}
          <div
            id="join"
            className={`scroll-mt-16 rounded-2xl border border-white/10 bg-black/30 p-6 text-zinc-100 shadow-2xl md:p-8 ${inviteLink ? "" : "hidden lg:block"}`}
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
                  <div
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 text-white shadow-lg"
                    style={{ backgroundColor: accent, borderColor: `${accent}99` }}
                  >
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
                        style={
                          isSel
                            ? { borderColor: accent, backgroundColor: `${accent}26`, boxShadow: `0 0 0 3px ${accent}33` }
                            : undefined
                        }
                        className={[
                          "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition",
                          isSel ? "" : "border-white/10 bg-white/5 hover:border-white/30",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white">{tierLabel(tier)}</span>
                            {tier.is_popular && (
                              <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                                ⭐ MOST POPULAR
                              </span>
                            )}
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
                          {orig > tier.price && (
                            <div className="text-[10px] font-semibold text-emerald-400">Save {inr(orig - tier.price)}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Continue to the dedicated checkout page */}
                <div className="mt-6">
                  {props.isPreview ? (
                    <div className="rounded-lg border border-dashed border-white/20 p-4 text-center text-sm text-white/60">
                      Checkout opens on the live page.
                    </div>
                  ) : selectedTier && props.slug ? (
                    <Button
                      asChild
                      style={{ backgroundColor: accent }}
                      className="w-full py-6 text-base font-semibold text-white hover:opacity-90"
                    >
                      <Link href={checkoutHref(selectedTier.id)}>
                        Continue to checkout · {inr(price)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <p className="rounded-lg border border-dashed border-white/20 p-4 text-center text-sm text-white/60">
                      Select a plan to continue.
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

      {/* ===== Mobile: plan bottom-sheet + fixed bottom bar ===== */}
      {!inviteLink && (
        <div className="lg:hidden">
          {sheetOpen && (
            <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSheetOpen(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div
                className="relative max-h-[82vh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 p-4 pb-6"
                style={{ background: theme.card }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
                <h3 className="mb-3 text-center font-sora text-lg font-bold text-white">Choose your plan</h3>
                <div className="space-y-3">
                  {tiers.map((tier) => {
                    const orig = tier.original_price ?? 0;
                    const off = orig > tier.price ? Math.round((1 - tier.price / orig) * 100) : 0;
                    const sel = tier.id === selectedTierId && mobileChosen;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => { setSelectedTierId(tier.id); setMobileChosen(true); setSheetOpen(false); }}
                        style={sel ? { borderColor: accent, backgroundColor: `${accent}26` } : undefined}
                        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left ${sel ? "" : "border-white/10 bg-white/5"}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white">{tierLabel(tier)}</span>
                            {tier.is_popular && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">⭐ POPULAR</span>}
                            {off > 0 && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">{off}% OFF</span>}
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/60">{tierDurationLabel(tier)}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          {orig > tier.price && <div className="text-xs text-white/40 line-through">{inr(orig)}</div>}
                          <div className="font-sora text-lg font-bold text-white">{inr(tier.price)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 p-3 backdrop-blur">
            {mobileChosen && selectedTier ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSheetOpen(true)} className="shrink-0 px-2 text-xs text-white/70 underline">
                  Change
                </button>
                <Button asChild className="flex-1 py-6 text-base font-semibold text-white" style={{ backgroundColor: accent }}>
                  <Link href={checkoutHref(selectedTier.id)}>
                    Continue · {inr(price)} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <Button type="button" onClick={() => setSheetOpen(true)} className="w-full py-6 text-base font-semibold text-white" style={{ backgroundColor: accent }}>
                Select a plan →
              </Button>
            )}
          </div>
        </div>
      )}
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

function OfferCountdown({ endsAt, accent }: { endsAt: string; accent: string }) {
  // null until mounted so SSR and first client paint match (no hydration warn).
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (left == null || left <= 0) return null;

  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const box = (v: number, l: string) => (
    <div className="flex flex-col items-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/40 font-sora text-2xl font-bold tabular-nums text-white"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}66` }}
      >
        {String(v).padStart(2, "0")}
      </div>
      <span className="mt-1 text-[9px] uppercase tracking-widest text-white/55">{l}</span>
    </div>
  );
  const sep = (k: string) => (
    <span key={k} className="self-start pt-2.5 text-xl font-bold" style={{ color: `${accent}99` }}>:</span>
  );
  return (
    <div
      className="mb-6 rounded-2xl border p-4 text-center"
      style={{ borderColor: `${accent}40`, background: `linear-gradient(180deg, ${accent}22, transparent)` }}
    >
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: accent }} />
        🔥 Limited-time offer ends in
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        {d > 0 && box(d, "Days")}
        {d > 0 && sep("s1")}
        {box(h, "Hrs")}
        {sep("s2")}
        {box(m, "Min")}
        {sep("s3")}
        {box(sec, "Sec")}
      </div>
    </div>
  );
}
