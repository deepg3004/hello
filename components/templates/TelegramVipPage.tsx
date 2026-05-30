"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Crown,
  ExternalLink,
  Lock,
  Send,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type { BaseTemplateProps, TemplateProduct } from "./shared/types";

// ── Helpers (kept from Phase 1 multi-tier work) ────────────────────────

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
  return (
    p.display_label?.trim() || p.name || formatDuration(p.subscription_days)
  );
}

function tierDurationLabel(p: TemplateProduct): string {
  return `${formatDuration(p.subscription_days)} access`;
}

// ── Types ───────────────────────────────────────────────────────────────

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
  /** Free-text under the group name — e.g. "🔥 1,247 active members". */
  members_label?: string;
  /** Numeric active-members count — drives the green pill auto-format. If
   *  set, takes precedence over `members_label` for the green pill. */
  active_members?: number;
  /** Bullet chips between the icon and the benefits — what's shared inside. */
  what_shared?: string;
  benefits_title?: string;
  benefits_items?: Benefit[];
  join_title?: string;
  join_note?: string;

  /** New: 2–3 short member testimonials shown below the pricing card. */
  testimonials_items?: MemberQuote[];
  /** New: "247 members joined this month" social-proof strip. */
  monthly_join_count?: number;
}

const TELEGRAM_BLUE = "#0088cc";

// ── Component ──────────────────────────────────────────────────────────

export function TelegramVipPage(props: TelegramVipPageProps) {
  const benefits = props.benefits_items ?? [];
  const sharedItems = (props.what_shared ?? "")
    .split(/[•·\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const testimonials = props.testimonials_items ?? [];

  // After checkout success the buyer is redirected back with ?invite=...
  // We render a "your link is ready" card and tick down a 10-minute timer
  // until the link is "expired" (still works — the timer is just a nudge).
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

  // Tiers (Weekly / Monthly / Yearly / Lifetime). Falls back to a single
  // [product] array when the seller hasn't set up multi-tier yet.
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
  const showTierPicker = tiers.length > 1;

  const price = selectedTier?.price ?? 0;
  const stickyPriceLabel = price
    ? `₹${Number(price).toLocaleString("en-IN")}`
    : "Join";

  return (
    <div
      className="min-h-screen text-zinc-100"
      style={{
        background:
          "linear-gradient(160deg, #0A1628 0%, #1A2B4A 55%, #0A1628 100%)",
      }}
    >
      {/* ====================================================================
          HERO — VIP badge, glowing Telegram icon, group name, member count
          ==================================================================== */}
      <section className="relative isolate overflow-hidden pb-12 pt-14 md:pb-16 md:pt-20">
        {/* Ambient glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-amber-400/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-0 h-[360px] w-[360px] rounded-full bg-sky-400/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-2xl px-4 text-center">
          {/* VIP Access pill */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
            <Crown className="h-3 w-3" />
            VIP Access
          </span>

          {/* Glowing Telegram icon circle */}
          <div className="relative mx-auto mt-6 h-24 w-24">
            {/* Glow halo */}
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse-slow rounded-full"
              style={{
                boxShadow: `0 0 60px 8px ${TELEGRAM_BLUE}80`,
              }}
            />
            <div
              className="relative flex h-full w-full items-center justify-center rounded-full border-2 shadow-xl"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, #1ea1d8 0%, #0088cc 60%, #006699 100%)",
                borderColor: `${TELEGRAM_BLUE}80`,
              }}
            >
              {props.group_avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.group_avatar}
                  alt={props.group_name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <Send className="h-10 w-10 -translate-x-0.5 text-white" />
              )}
            </div>
          </div>

          <h1 className="mt-6 font-sora text-[34px] font-bold leading-tight tracking-tight text-white sm:text-[40px]">
            {props.group_name}
          </h1>

          {/* Active members green pill */}
          {(props.active_members != null || props.members_label) && (
            <div className="mt-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                <span className="inline-block h-1.5 w-1.5 animate-pulse-slow rounded-full bg-emerald-400" />
                <Users className="h-3 w-3" />
                {props.active_members != null
                  ? `${props.active_members.toLocaleString("en-IN")} active members`
                  : props.members_label}
              </span>
            </div>
          )}

          {/* Tag chips */}
          {sharedItems.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {sharedItems.slice(0, 8).map((s, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200 backdrop-blur"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          BENEFITS — gold checkmarks
          ==================================================================== */}
      {benefits.length > 0 && (
        <section className="border-t border-white/5 bg-[#08131f]/60 py-12 backdrop-blur md:py-16">
          <div className="mx-auto max-w-2xl px-4">
            {props.benefits_title && (
              <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white">
                {props.benefits_title}
              </h2>
            )}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {benefits.slice(0, 8).map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-white/90">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ====================================================================
          JOIN — invite-link card (post-payment) OR pricing tier + checkout
          ==================================================================== */}
      <section
        id="join"
        className="scroll-mt-16 px-4 pb-32 pt-12 md:pb-16 md:pt-16"
      >
        <div className="mx-auto max-w-2xl">
          {props.join_title && !inviteLink && (
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {props.join_title}
            </h2>
          )}
          {props.join_note && !inviteLink && (
            <p className="mt-2 text-center text-sm text-white/65">
              {props.join_note}
            </p>
          )}

          {inviteLink ? (
            <InviteLinkCard
              groupName={props.group_name}
              link={inviteLink}
              secondsLeft={inviteSecondsLeft}
            />
          ) : (
            <>
              {/* Tier picker */}
              {showTierPicker && (
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {tiers.map((tier) => {
                    const isSelected = tier.id === selectedTierId;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTierId(tier.id)}
                        className={[
                          "relative rounded-xl border-2 p-4 text-left transition",
                          isSelected
                            ? "border-amber-400 bg-amber-400/5 ring-2 ring-amber-400/20"
                            : "border-white/10 bg-white/5 hover:border-white/30",
                        ].join(" ")}
                      >
                        {isSelected && (
                          <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-zinc-950">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                          {tierLabel(tier)}
                        </p>
                        <p className="mt-2 font-sora text-2xl font-bold text-white">
                          ₹{Number(tier.price).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-1 text-[11px] text-white/65">
                          {tierDurationLabel(tier)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pricing + checkout card (centered, max-w-sm) */}
              <div className="mx-auto mt-8 max-w-md rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-7">
                {/* Duration badge */}
                {selectedTier && (
                  <div className="mb-4 text-center">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-sm"
                      style={{ background: TELEGRAM_BLUE }}
                    >
                      <Sparkles className="h-3 w-3" />
                      {formatDuration(selectedTier.subscription_days)} access
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <p className="font-sora text-5xl font-bold tracking-tight text-zinc-900">
                    ₹{Number(price).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
                    One-time payment
                  </p>
                </div>

                {/* What you get — pulls from benefits if seller hasn't
                    overridden join_note. Compact 3-line list. */}
                {benefits.length > 0 && (
                  <ul className="mt-5 space-y-2 border-y border-zinc-100 py-4">
                    {benefits.slice(0, 4).map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-zinc-700"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Checkout */}
                <div className="mt-5">
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
                        props.bumpRuntime
                          ? { ...props.bumpRuntime, ready: true }
                          : undefined
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

                {/* Trust strip */}
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                    <Lock className="h-3 w-3" />
                    SSL Encrypted · Powered by Razorpay
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    {["UPI", "Visa", "Mastercard", "RuPay"].map((m) => (
                      <span
                        key={m}
                        className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ====================================================================
          SOCIAL PROOF — recent members strip + testimonials
          ==================================================================== */}
      {(testimonials.length > 0 || props.monthly_join_count) && (
        <section className="border-t border-white/5 bg-[#08131f]/40 py-12 backdrop-blur md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            {props.monthly_join_count != null && props.monthly_join_count > 0 && (
              <RecentMembersStrip count={props.monthly_join_count} />
            )}

            {testimonials.length > 0 && (
              <div className="mt-8 grid gap-3 md:grid-cols-2">
                {testimonials.slice(0, 4).map((t, i) => (
                  <figure
                    key={i}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
                  >
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className="h-3.5 w-3.5"
                          fill="currentColor"
                        />
                      ))}
                    </div>
                    <blockquote className="mt-3 text-sm leading-relaxed text-white/90">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-zinc-950"
                      >
                        {initials(t.author)}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {t.author}
                        </div>
                        {t.role && (
                          <div className="text-xs text-white/60">{t.role}</div>
                        )}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <StickyCheckoutBar
        targetId="join"
        priceLabel={stickyPriceLabel}
        cta="Join Group"
        buttonClassName="bg-amber-400 text-zinc-950"
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
  const mmss = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border-2 border-amber-400/40 bg-white p-6 text-zinc-900 shadow-2xl">
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
        className="mt-5 w-full bg-[#0088cc] py-6 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-[#0099e0]"
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
            secondsLeft <= 60
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-50 text-amber-700",
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
  // Avatar gradient palette — same shape as the seller dashboard.
  const palette = [
    "from-amber-500 to-orange-600",
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600",
  ];
  // 6 placeholder initial-circles — purely decorative.
  const initials = ["PS", "RK", "AM", "JT", "SN", "VG"];

  return (
    <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
      <div className="flex -space-x-2">
        {initials.map((init, i) => (
          <span
            key={i}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full",
              "border-2 border-[#0a1628] bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
              palette[i % palette.length] ?? "from-sky-500 to-blue-600",
            ].join(" ")}
            style={{ zIndex: 10 - i }}
          >
            {init}
          </span>
        ))}
      </div>
      <span className="text-sm text-white/80">
        <span className="font-bold text-amber-300">
          {count.toLocaleString("en-IN")}
        </span>{" "}
        members joined this month
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
