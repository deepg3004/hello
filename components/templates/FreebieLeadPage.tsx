"use client";

import { LeadCaptureForm } from "@/components/pages/LeadCaptureForm";
import type { BaseTemplateProps } from "./shared/types";

interface BulletItem { text: string }

export interface FreebieLeadPageProps extends BaseTemplateProps {
  badge_text?: string;
  hero_headline: string;
  hero_subheadline?: string;
  inside_title?: string;
  inside_items?: BulletItem[];
  optin_cta?: string;
  optin_privacy?: string;
  /** URL the buyer is sent to after submitting — usually the download. */
  redirect_url?: string;
}

export function FreebieLeadPage(props: FreebieLeadPageProps) {
  const inside = props.inside_items ?? [];

  return (
    <div className="min-h-screen bg-[#fff7ed] text-zinc-900">
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        {props.badge_text && (
          <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rose-600">
            {props.badge_text}
          </span>
        )}
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {props.hero_headline}
        </h1>
        {props.hero_subheadline && (
          <p className="mt-5 text-lg leading-relaxed text-zinc-600">
            {props.hero_subheadline}
          </p>
        )}
      </section>

      {inside.length > 0 && (
        <section className="border-y border-rose-100 bg-white py-12">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-xl font-semibold tracking-tight">
              {props.inside_title}
            </h2>
            <ul className="mt-5 space-y-3">
              {inside.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-600">
                    ✓
                  </span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="mx-auto max-w-md px-6">
          <div className="rounded-xl border border-rose-100 bg-white p-6 shadow-sm">
            {props.pageId && !props.isPreview ? (
              <LeadCaptureForm
                pageId={props.pageId}
                ctaLabel={props.optin_cta ?? "Send it to me"}
                requirePhone={false}
                redirectUrl={props.redirect_url}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                Opt-in form renders on the live page.
              </p>
            )}
          </div>
          {props.optin_privacy && (
            <p className="mt-4 text-center text-xs text-zinc-500">
              {props.optin_privacy}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
