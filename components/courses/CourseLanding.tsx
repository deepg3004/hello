"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  Lock,
  PlayCircle,
  ShieldCheck,
  Signal,
  Star,
  Users,
  X,
} from "lucide-react";

import { formatINR, formatDate } from "@/lib/utils";
import { Stars } from "@/components/store/Stars";
import { ReviewsSection } from "@/components/store/ReviewsSection";
import { cardClassName } from "@/components/store/ProductCard";
import { CourseCard, type CourseCardItem } from "@/components/courses/CourseCard";
import { CheckoutForm } from "@/components/pages/CheckoutForm";
import type { CardStyle } from "@/lib/storefront-theme";
import {
  CoursePreviewModal,
  type PreviewLesson,
} from "@/components/courses/CoursePreviewModal";
import type { ReviewRow, ReviewSummary } from "@/lib/reviews";

export interface LandingLesson {
  id: string;
  title: string;
  duration_label: string | null;
  is_preview: boolean;
  video_url: string | null;
}
export interface LandingModule {
  id: string;
  title: string;
  lessons: LandingLesson[];
}

export interface CourseLandingProps {
  courseId: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  sellerName: string | null;
  category: string | null;
  level: string | null;
  language: string;
  updatedAt: string | null;
  instructor: { name: string | null; bio: string | null; avatar: string | null };
  whatYouLearn: string[];
  requirements: string[];
  whoFor: string[];
  modules: LandingModule[];
  priceRupees: number | null;
  originalPriceRupees: number | null;
  checkoutUrl: string | null;
  /** Inline (on-site) checkout — opens the checkout form in a modal instead of
   *  navigating to the separate /p payment page. */
  checkout?: {
    pageId: string;
    productId: string;
    productName: string;
    price: number;
    accent: string | null;
  } | null;
  previewLessons: PreviewLesson[];
  previewToken: string;
  rating: ReviewSummary;
  reviews: ReviewRow[];
  students: number;
  related: CourseCardItem[];
  cardStyle?: CardStyle;
  showRatings?: boolean;
  showRelated?: boolean;
}

export function CourseLanding(props: CourseLandingProps) {
  const {
    courseId,
    title,
    subtitle,
    description,
    thumbnailUrl,
    sellerName,
    category,
    level,
    language,
    updatedAt,
    instructor,
    whatYouLearn,
    requirements,
    whoFor,
    modules,
    priceRupees,
    originalPriceRupees,
    checkoutUrl,
    previewLessons,
    previewToken,
    rating,
    reviews,
    students,
    related,
    cardStyle = "elevated",
    showRatings = true,
    showRelated = true,
  } = props;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStart, setPreviewStart] = useState<string | null>(null);
  const checkout = props.checkout ?? null;
  const [buyOpen, setBuyOpen] = useState(false);
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const off =
    originalPriceRupees != null && priceRupees != null && originalPriceRupees > priceRupees
      ? Math.round(((originalPriceRupees - priceRupees) / originalPriceRupees) * 100)
      : 0;
  const hasPreview = previewLessons.length > 0;

  function openPreview(id?: string) {
    setPreviewStart(id ?? previewLessons[0]?.id ?? null);
    setPreviewOpen(true);
  }

  const includes = [
    `${modules.length} module${modules.length === 1 ? "" : "s"} · ${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`,
    "Full lifetime access",
    "Access on mobile & desktop",
    "Certificate of completion",
  ];

  return (
    <>
      {/* Hero band */}
      <div className="sf-band sf-border border-b">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {category && <p className="sf-accent mb-2 text-sm font-semibold uppercase tracking-wider">{category}</p>}
            <h1 className="sf-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && <p className="sf-muted mt-3 text-lg">{subtitle}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {showRatings && rating.count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold text-amber-500">{rating.average.toFixed(1)}</span>
                  <Stars value={rating.average} size={15} />
                  <span className="sf-muted">({rating.count} rating{rating.count === 1 ? "" : "s"})</span>
                </span>
              )}
              <span className="sf-muted inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {students} student{students === 1 ? "" : "s"}
              </span>
            </div>

            <p className="sf-muted mt-3 text-sm">
              Created by <span className="font-medium" style={{ color: "var(--sf-fg)" }}>{instructor.name ?? sellerName ?? "the instructor"}</span>
            </p>
            <div className="sf-muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {updatedAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Updated {formatDate(updatedAt)}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> {language}
              </span>
              {level && (
                <span className="inline-flex items-center gap-1">
                  <Signal className="h-3.5 w-3.5" /> {level}
                </span>
              )}
            </div>
          </div>

          {/* Spacer for the floating card on desktop */}
          <div className="hidden lg:block" />
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-40 sm:px-6 lg:grid-cols-[1fr_360px] lg:pb-10">
        {/* Left column */}
        <div className="min-w-0 space-y-10">
          {/* What you'll learn */}
          {whatYouLearn.length > 0 && (
            <section className="sf-card p-5">
              <h2 className="mb-3 sf-display text-xl font-semibold">What you’ll learn</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {whatYouLearn.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Curriculum */}
          <section>
            <h2 className="sf-display text-xl font-semibold">
              Course content{" "}
              <span className="ml-1 text-sm font-normal sf-muted">
                {modules.length} module{modules.length === 1 ? "" : "s"} · {lessonCount} lesson
                {lessonCount === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="sf-card mt-3 divide-y overflow-hidden" style={{ borderColor: "var(--sf-border)" }}>
              {modules.map((m, i) => (
                <ModuleRow key={m.id} module={m} defaultOpen={i === 0} onPreview={openPreview} />
              ))}
            </div>
          </section>

          {/* Requirements */}
          {requirements.length > 0 && (
            <section>
              <h2 className="mb-3 sf-display text-xl font-semibold">Requirements</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm sf-muted">
                {requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Description */}
          {description && (
            <section>
              <h2 className="mb-3 sf-display text-xl font-semibold">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed sf-muted">{description}</p>
            </section>
          )}

          {/* Who this is for */}
          {whoFor.length > 0 && (
            <section>
              <h2 className="mb-3 sf-display text-xl font-semibold">Who this course is for</h2>
              <ul className="space-y-1.5 text-sm sf-muted">
                {whoFor.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Instructor */}
          {(instructor.name || instructor.bio) && (
            <section className="sf-border border-t pt-8">
              <h2 className="mb-4 sf-display text-xl font-semibold">Instructor</h2>
              <div className="flex items-start gap-4">
                {instructor.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instructor.avatar} alt={instructor.name ?? ""} className="h-16 w-16 rounded-full border-2 border-[var(--sf-accent)] object-cover" />
                ) : (
                  <div className="sf-accent-bg flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold">
                    {(instructor.name ?? sellerName ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold">{instructor.name ?? sellerName}</p>
                  {instructor.bio && (
                    <p className="mt-1 whitespace-pre-line text-sm sf-muted">{instructor.bio}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Reviews */}
          <div id="reviews">
            <ReviewsSection
              subjectType="course"
              subjectId={courseId}
              summary={rating}
              reviews={reviews}
              subjectLabel="course"
            />
          </div>

          {/* Related */}
          {showRelated && related.length > 0 && (
            <section className="sf-border border-t pt-8">
              <h2 className="mb-4 sf-display text-xl font-semibold">More courses</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {related.map((c) => (
                  <CourseCard key={c.id} c={c} base="/course" cardStyle={cardStyle} showRatings={showRatings} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column — sticky buy card */}
        <aside className="lg:-mt-44">
          <div className="sf-card sticky top-6 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              onClick={() => hasPreview && openPreview()}
              className="relative block aspect-video w-full"
            >
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[var(--sf-bg2)] to-[var(--sf-surface)]" />
              )}
              {hasPreview && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35 text-white">
                  <PlayCircle className="h-12 w-12" />
                  <span className="text-sm font-semibold">Preview this course</span>
                </span>
              )}
            </button>

            <div className="p-5">
              <div className="flex items-baseline gap-2">
                {priceRupees != null ? (
                  <>
                    <span className="sf-display text-3xl font-bold">
                      {formatINR(Math.round(priceRupees * 100))}
                    </span>
                    {originalPriceRupees != null && originalPriceRupees > priceRupees && (
                      <>
                        <span className="text-sm sf-muted line-through">
                          {formatINR(Math.round(originalPriceRupees * 100))}
                        </span>
                        <span className="text-sm font-semibold text-rose-600">{off}% off</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="sf-display text-2xl font-bold">Free</span>
                )}
              </div>

              {checkout ? (
                <button
                  type="button"
                  onClick={() => setBuyOpen(true)}
                  className="sf-btn mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
                >
                  Enroll now
                </button>
              ) : checkoutUrl ? (
                <a href={checkoutUrl} className="sf-btn mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
                  Enroll now
                </a>
              ) : (
                <p className="sf-band mt-4 rounded-lg px-4 py-3 text-center text-sm sf-muted">Enrollment opens soon.</p>
              )}
              {hasPreview && (
                <button
                  onClick={() => openPreview()}
                  className="sf-btn-outline mt-2 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                >
                  <PlayCircle className="h-4 w-4" /> Watch free preview
                </button>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs sf-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout · Instant access
              </p>

              <div className="sf-border mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-semibold">This course includes</p>
                <ul className="space-y-1.5 text-sm sf-muted">
                  {includes.map((it, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Sticky mobile buy bar */}
      <div className="sf-band sf-border fixed inset-x-0 bottom-16 z-40 flex items-center justify-between gap-3 border-t px-4 py-3 shadow-lg md:bottom-0 lg:hidden">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {priceRupees != null ? (
            <span className="text-lg font-bold">{formatINR(Math.round(priceRupees * 100))}</span>
          ) : (
            <span className="text-lg font-bold">Free</span>
          )}
          {off > 0 && originalPriceRupees != null && (
            <span className="text-xs sf-muted line-through">{formatINR(Math.round(originalPriceRupees * 100))}</span>
          )}
          {off > 0 && <span className="text-xs font-semibold text-rose-500">{off}% off</span>}
        </div>
        {checkout ? (
          <button
            type="button"
            onClick={() => setBuyOpen(true)}
            className="sf-btn px-5 py-2.5 text-sm font-semibold"
          >
            Enroll now
          </button>
        ) : checkoutUrl ? (
          <a href={checkoutUrl} className="sf-btn px-5 py-2.5 text-sm font-semibold">
            Enroll now
          </a>
        ) : (
          <span className="text-sm sf-muted">Opens soon</span>
        )}
      </div>

      {/* Inline checkout — a PLAIN modal (not Radix) so it never sets
          body{pointer-events:none}, which would make the Razorpay/Cashfree
          popup unclickable (the cart-drawer bug). */}
      {checkout && buyOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
          onClick={() => setBuyOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-background p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setBuyOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground transition hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <CheckoutForm
              pageId={checkout.pageId}
              productId={checkout.productId}
              productName={checkout.productName}
              price={checkout.price}
              currency="INR"
              primaryColor={checkout.accent ?? undefined}
            />
          </div>
        </div>
      )}

      {hasPreview && (
        <CoursePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          lessons={previewLessons}
          previewToken={previewToken}
          initialId={previewStart}
        />
      )}
    </>
  );
}

function ModuleRow({
  module: m,
  defaultOpen,
  onPreview,
}: {
  module: LandingModule;
  defaultOpen: boolean;
  onPreview: (id?: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="sf-band flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold"
      >
        <ChevronDown className={"h-4 w-4 shrink-0 transition " + (open ? "" : "-rotate-90")} />
        <span className="flex-1">{m.title}</span>
        <span className="text-xs font-normal sf-muted">
          {m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-border">
          {m.lessons.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              {l.is_preview ? (
                <button onClick={() => onPreview(l.id)} className="sf-accent flex flex-1 items-center gap-2 text-left hover:underline">
                  <PlayCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{l.title}</span>
                  <span className="sf-accent-bg rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">Preview</span>
                </button>
              ) : (
                <span className="flex flex-1 items-center gap-2 sf-muted">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{l.title}</span>
                </span>
              )}
              {l.duration_label && (
                <span className="text-xs sf-muted">{l.duration_label}</span>
              )}
            </li>
          ))}
          {m.lessons.length === 0 && (
            <li className="px-4 py-2.5 text-xs sf-muted">Coming soon.</li>
          )}
        </ul>
      )}
    </div>
  );
}
