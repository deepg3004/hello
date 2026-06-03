"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Calendar, Clock, Lock, Sparkles, Video } from "lucide-react";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { tgTheme } from "@/lib/telegram-themes";
import { BgAnimation } from "./BgAnimation";
import { Countdown } from "./shared/Countdown";
import { SecureFooter } from "@/components/templates/shared/SecureFooter";
import { StickyFormCta } from "@/components/templates/shared/StickyFormCta";
import type { BaseTemplateProps } from "./shared/types";

interface AgendaItem {
  text: string;
  /** Optional 1-line description for the topic. */
  description?: string;
}

export interface LandingWebinarPageProps extends BaseTemplateProps {
  banner_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  host_name?: string;
  host_title?: string;
  host_bio?: string;
  host_avatar?: string;
  agenda_title?: string;
  agenda_items?: AgendaItem[];
  register_title?: string;
  register_cta?: string;
  register_count_label?: string;
  /** Optional URL to redirect to after successful registration. */
  redirect_url?: string;
  /** Total seats available — drives the "X of N seats left" progress bar.
   *  Optional. When absent the seats meter is hidden. */
  total_seats?: number;
  /** Currently filled seats. Used with total_seats to show progress. */
  seats_filled?: number;
  /** Social-proof number rendered below the form ("2,304 already registered"). */
  registered_count?: number;
  /** Event date for the calendar chip + countdown ISO. */
  event_date_label?: string;
  /** Seller-pickable colour theme (dark gradient bg + accent). */
  theme_key?: string;
  /** Optional ambient background animation. */
  bg_animation?: string;
}

export function LandingWebinarPage(props: LandingWebinarPageProps) {
  const theme = tgTheme(props.theme_key);
  const accent = theme.accent;
  const agenda = props.agenda_items ?? [];
  const totalSeats = props.total_seats ?? 0;
  const filled = props.seats_filled ?? 0;
  const seatsLeft = Math.max(0, totalSeats - filled);
  const showSeats = totalSeats > 0;
  const fillPct = totalSeats > 0 ? Math.min(100, (filled / totalSeats) * 100) : 0;
  const lowSeats = totalSeats > 0 && seatsLeft / totalSeats < 0.2;

  // Smooth-scroll to the registration card from the sticky header CTA.
  const [headerVisible, setHeaderVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setHeaderVisible(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen text-white" style={{ background: theme.bg }}>
      <BgAnimation type={props.bg_animation} />

      {/* ── Sticky header (slides in after scrolling past hero) ─────── */}
      <header
        className={[
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          "border-b border-white/10 backdrop-blur",
          headerVisible ? "translate-y-0" : "-translate-y-full",
        ].join(" ")}
        style={{ backgroundColor: `${theme.card}f2` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse-slow rounded-full bg-emerald-400" />
              Free Webinar
            </span>
            <span className="truncate text-sm font-medium text-white/90">
              {props.hero_headline}
            </span>
          </div>
          <a
            href="#register"
            className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Register Free →
          </a>
        </div>
      </header>

      <div className="relative z-10 pb-24 md:pb-0">

      {/* Optional top banner */}
      {props.banner_text && (
        <div
          className="px-4 py-2 text-center text-sm font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          <span className="mr-2 inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          {props.banner_text}
        </div>
      )}

      {/* ====================================================================
          HERO + REGISTRATION (2-col on lg)
          ==================================================================== */}
      <section className="relative isolate overflow-hidden">
        {/* Radial glow — tinted with the theme accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}33` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}26` }}
        />
        {/* Subtle grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-24 md:pb-20 md:pt-28 lg:grid-cols-[1.4fr_minmax(0,1fr)] lg:gap-12">
          {/* LEFT — hero copy */}
          <div className="text-center lg:text-left">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse-slow rounded-full bg-emerald-400" />
              Free Webinar
            </span>

            {/* Countdown (if seller set one) */}
            {props.timer?.enabled && props.timer.target && (
              <div className="mb-6 mx-auto inline-block lg:mx-0">
                <Countdown
                  targetIso={props.timer.target}
                  label={props.timer.label ?? "Starts in"}
                  boxClassName="bg-white text-purple-900"
                />
              </div>
            )}

            <h1 className="font-sora text-[40px] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[52px]">
              {props.hero_headline}
            </h1>

            {props.hero_subheadline && (
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg md:text-xl lg:mx-0 mx-auto">
                {props.hero_subheadline}
              </p>
            )}

            {/* Event meta chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm lg:justify-start">
              {props.event_date_label && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/90">
                  <Calendar className="h-3.5 w-3.5" />
                  {props.event_date_label}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/90">
                <Video className="h-3.5 w-3.5" />
                Live + Q&amp;A
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/90">
                <Clock className="h-3.5 w-3.5" />
                60 minutes
              </span>
            </div>

            {/* Host row */}
            {(props.host_name || props.host_avatar) && (
              <div className="mt-8 flex items-center gap-3 lg:justify-start justify-center">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/30 bg-purple-950">
                  {props.host_avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={props.host_avatar}
                      alt={props.host_name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-sora text-base font-bold text-white/60">
                      {(props.host_name ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">
                    Hosted by
                  </p>
                  <p className="font-sora text-sm font-semibold text-white">
                    {props.host_name}
                  </p>
                  {props.host_title && (
                    <p className="text-xs text-white/60">{props.host_title}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — registration card (sticky on desktop) */}
          <aside
            id="register"
            className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start"
          >
            <div className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-8">
              <h2 className="font-sora text-xl font-bold tracking-tight">
                {props.register_title ?? "Reserve Your Seat"}
              </h2>
              {props.register_count_label && (
                <p className="mt-1 text-sm text-zinc-500">
                  {props.register_count_label}
                </p>
              )}

              {/* Seats remaining bar */}
              {showSeats && (
                <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span
                      className={
                        lowSeats ? "text-rose-600" : "text-zinc-700"
                      }
                    >
                      {seatsLeft.toLocaleString("en-IN")} of{" "}
                      {totalSeats.toLocaleString("en-IN")} seats left
                    </span>
                    {lowSeats && (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                        Filling fast
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${fillPct}%`,
                        backgroundColor: lowSeats ? "#f43f5e" : accent,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="mt-5">
                {props.pageId && !props.isPreview ? (
                  <LeadCaptureForm
                    pageId={props.pageId}
                    ctaLabel={props.register_cta ?? "Register free"}
                    requirePhone
                    redirectUrl={props.redirect_url}
                    formConfig={props.formConfig}
                    primaryColor={accent}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                    Registration form renders on the live page.
                  </p>
                )}
              </div>

              {/* Trust strip */}
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                  <Lock className="h-3 w-3" />
                  No spam · Unsubscribe anytime
                </p>
                {typeof props.registered_count === "number" &&
                  props.registered_count > 0 && (
                    <p className="mt-2 text-center text-xs text-zinc-500">
                      <span className="font-semibold text-emerald-600">
                        {props.registered_count.toLocaleString("en-IN")}
                      </span>{" "}
                      already registered
                    </p>
                  )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ====================================================================
          WHAT YOU'LL LEARN (grid)
          ==================================================================== */}
      {agenda.length > 0 && (
        <section className="py-16 text-zinc-100 md:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center font-sora text-2xl font-bold tracking-tight sm:text-3xl">
              {props.agenda_title ?? "What you'll learn"}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {agenda.map((b, i) => (
                <li
                  key={i}
                  className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07]"
                >
                  <span
                    aria-hidden
                    className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full font-sora text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: accent }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-sora text-sm font-semibold text-white">
                    {b.text}
                  </p>
                  {b.description && (
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                      {b.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ====================================================================
          HOST BIO
          ==================================================================== */}
      {(props.host_name || props.host_bio) && (
        <section className="py-16 text-zinc-100 md:py-20">
          <div className="mx-auto max-w-3xl px-4">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
              <div
                className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 bg-white/10 shadow-lg"
                style={{ borderColor: accent }}
              >
                {props.host_avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={props.host_avatar}
                    alt={props.host_name ?? ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center font-sora text-2xl font-bold text-white"
                    style={{ backgroundColor: `${accent}40` }}
                  >
                    {(props.host_name ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: accent }}
                >
                  Your host
                </p>
                <h3 className="mt-1 font-sora text-2xl font-bold tracking-tight">
                  {props.host_name}
                </h3>
                {props.host_title && (
                  <p className="text-sm text-zinc-400">{props.host_title}</p>
                )}
                {props.host_bio && (
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    {props.host_bio}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          FINAL CTA STRIP
          ==================================================================== */}
      <section
        className="py-12 text-center text-white"
        style={{ backgroundColor: theme.card }}
      >
        <div className="mx-auto max-w-xl px-4">
          <h3 className="font-sora text-2xl font-bold tracking-tight">
            Ready to join the live session?
          </h3>
          <p className="mt-2 text-sm text-white/70">
            It&apos;s free. It&apos;s live. And there&apos;s a Q&amp;A at the end.
          </p>
          <a
            href="#register"
            className="mt-6 inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-semibold text-white shadow-lg transition hover:scale-105 hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Reserve my seat
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </a>
        </div>
      </section>

      <SecureFooter accent={accent} variant="lite" />

      <StickyFormCta
        label={props.register_cta ?? "Save my spot"}
        accent={accent}
        targetId="register"
      />
      </div>
    </div>
  );
}
