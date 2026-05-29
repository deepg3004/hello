"use client";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import { Countdown } from "./shared/Countdown";
import type { BaseTemplateProps } from "./shared/types";

interface AgendaItem { text: string }

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
}

export function LandingWebinarPage(props: LandingWebinarPageProps) {
  const agenda = props.agenda_items ?? [];

  return (
    <div className="min-h-screen bg-[#0b0b14] text-zinc-100">
      {props.banner_text && (
        <div className="bg-indigo-600 px-4 py-2 text-center text-sm font-medium">
          {props.banner_text}
        </div>
      )}

      <section
        className="px-4 pb-12 pt-16 text-center"
        style={{
          background:
            "linear-gradient(160deg, #0b0b14 0%, #131329 70%, #0b0b14 100%)",
        }}
      >
        {props.timer?.enabled && props.timer.target && (
          <div className="mx-auto mb-8 flex max-w-3xl justify-center">
            <Countdown
              targetIso={props.timer.target}
              label={props.timer.label ?? "Live in"}
              boxClassName="bg-indigo-500/15 text-indigo-100"
            />
          </div>
        )}
        <div className="mx-auto max-w-3xl">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {props.hero_headline}
          </h1>
          {props.hero_subheadline && (
            <p className="mt-5 text-lg leading-relaxed text-zinc-300">
              {props.hero_subheadline}
            </p>
          )}
        </div>
      </section>

      {(props.host_name || props.host_bio) && (
        <section className="border-t border-white/5 py-12">
          <div className="mx-auto flex max-w-3xl items-center gap-5 px-6">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {props.host_avatar ? (
                <img
                  src={props.host_avatar}
                  alt={props.host_name ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-indigo-300">
                Hosted by
              </p>
              <div className="font-medium">{props.host_name}</div>
              <div className="text-sm text-zinc-400">{props.host_title}</div>
              <p className="mt-2 text-sm text-zinc-300">{props.host_bio}</p>
            </div>
          </div>
        </section>
      )}

      {agenda.length > 0 && (
        <section className="border-t border-white/5 bg-[#10101c] py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {props.agenda_title}
            </h2>
            <ul className="mt-6 space-y-3">
              {agenda.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-5 w-5 shrink-0 rounded-full bg-indigo-500/20 text-center text-xs font-semibold leading-5 text-indigo-300">
                    {i + 1}
                  </span>
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="register" className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-md px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            {props.register_title}
          </h2>
          {props.register_count_label && (
            <p className="mt-2 text-center text-sm text-zinc-400">
              {props.register_count_label}
            </p>
          )}
          <div className="mt-6 rounded-xl bg-white p-6 text-zinc-900">
            {props.pageId && !props.isPreview ? (
              <LeadCaptureForm
                pageId={props.pageId}
                ctaLabel={props.register_cta ?? "Register free"}
                requirePhone
                redirectUrl={props.redirect_url}
                formConfig={props.formConfig}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                Registration form renders on the live page.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
