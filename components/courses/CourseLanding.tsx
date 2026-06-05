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
} from "lucide-react";

import { formatINR, formatDate } from "@/lib/utils";
import { Stars } from "@/components/store/Stars";
import { ReviewsSection } from "@/components/store/ReviewsSection";
import { CourseCard, type CourseCardItem } from "@/components/courses/CourseCard";
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
  previewLessons: PreviewLesson[];
  previewToken: string;
  rating: ReviewSummary;
  reviews: ReviewRow[];
  students: number;
  related: CourseCardItem[];
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
  } = props;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStart, setPreviewStart] = useState<string | null>(null);
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
      <div className="bg-zinc-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {category && (
              <p className="mb-2 text-sm font-medium text-indigo-300">{category}</p>
            )}
            <h1 className="font-sora text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle && <p className="mt-3 text-lg text-zinc-300">{subtitle}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {rating.count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold text-amber-400">{rating.average.toFixed(1)}</span>
                  <Stars value={rating.average} size={15} />
                  <span className="text-zinc-300">({rating.count} rating{rating.count === 1 ? "" : "s"})</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-zinc-300">
                <Users className="h-4 w-4" /> {students} student{students === 1 ? "" : "s"}
              </span>
            </div>

            <p className="mt-3 text-sm text-zinc-300">
              Created by{" "}
              <span className="font-medium text-white">
                {instructor.name ?? sellerName ?? "the instructor"}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
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

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="min-w-0 space-y-10">
          {/* What you'll learn */}
          {whatYouLearn.length > 0 && (
            <section className="rounded-xl border p-5">
              <h2 className="mb-3 font-sora text-xl font-semibold">What you’ll learn</h2>
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
            <h2 className="font-sora text-xl font-semibold">
              Course content{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {modules.length} module{modules.length === 1 ? "" : "s"} · {lessonCount} lesson
                {lessonCount === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border">
              {modules.map((m, i) => (
                <ModuleRow key={m.id} module={m} defaultOpen={i === 0} onPreview={openPreview} />
              ))}
            </div>
          </section>

          {/* Requirements */}
          {requirements.length > 0 && (
            <section>
              <h2 className="mb-3 font-sora text-xl font-semibold">Requirements</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Description */}
          {description && (
            <section>
              <h2 className="mb-3 font-sora text-xl font-semibold">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{description}</p>
            </section>
          )}

          {/* Who this is for */}
          {whoFor.length > 0 && (
            <section>
              <h2 className="mb-3 font-sora text-xl font-semibold">Who this course is for</h2>
              <ul className="space-y-1.5 text-sm text-zinc-700">
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
            <section className="border-t pt-8">
              <h2 className="mb-4 font-sora text-xl font-semibold">Instructor</h2>
              <div className="flex items-start gap-4">
                {instructor.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instructor.avatar} alt={instructor.name ?? ""} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-600">
                    {(instructor.name ?? sellerName ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold">{instructor.name ?? sellerName}</p>
                  {instructor.bio && (
                    <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{instructor.bio}</p>
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
          {related.length > 0 && (
            <section className="border-t pt-8">
              <h2 className="mb-4 font-sora text-xl font-semibold">More courses</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {related.map((c) => (
                  <CourseCard key={c.id} c={c} base="/course" />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column — sticky buy card */}
        <aside className="lg:-mt-44">
          <div className="card-surface sticky top-6 overflow-hidden rounded-xl border bg-white shadow-lg">
            <button
              type="button"
              onClick={() => hasPreview && openPreview()}
              className="relative block aspect-video w-full bg-zinc-100"
            >
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-indigo-100 to-violet-100" />
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
                    <span className="font-sora text-3xl font-bold">
                      {formatINR(Math.round(priceRupees * 100))}
                    </span>
                    {originalPriceRupees != null && originalPriceRupees > priceRupees && (
                      <>
                        <span className="text-sm text-muted-foreground line-through">
                          {formatINR(Math.round(originalPriceRupees * 100))}
                        </span>
                        <span className="text-sm font-semibold text-rose-600">{off}% off</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="font-sora text-2xl font-bold">Free</span>
                )}
              </div>

              {checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Enroll now
                </a>
              ) : (
                <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                  Enrollment opens soon.
                </p>
              )}
              {hasPreview && (
                <button
                  onClick={() => openPreview()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-primary"
                >
                  <PlayCircle className="h-4 w-4" /> Watch free preview
                </button>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout · Instant access
              </p>

              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-semibold">This course includes</p>
                <ul className="space-y-1.5 text-sm text-zinc-600">
                  {includes.map((it, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Sticky mobile buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-white px-4 py-3 shadow-lg lg:hidden">
        <div className="flex items-baseline gap-2">
          {priceRupees != null ? (
            <span className="text-lg font-bold">{formatINR(Math.round(priceRupees * 100))}</span>
          ) : (
            <span className="text-lg font-bold">Free</span>
          )}
          {off > 0 && <span className="text-xs font-semibold text-rose-600">{off}% off</span>}
        </div>
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Enroll now
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">Opens soon</span>
        )}
      </div>

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
        className="flex w-full items-center gap-2 bg-muted/40 px-4 py-3 text-left text-sm font-semibold"
      >
        <ChevronDown className={"h-4 w-4 shrink-0 transition " + (open ? "" : "-rotate-90")} />
        <span className="flex-1">{m.title}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-border">
          {m.lessons.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              {l.is_preview ? (
                <button
                  onClick={() => onPreview(l.id)}
                  className="flex flex-1 items-center gap-2 text-left text-primary hover:underline"
                >
                  <PlayCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{l.title}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    Preview
                  </span>
                </button>
              ) : (
                <span className="flex flex-1 items-center gap-2 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{l.title}</span>
                </span>
              )}
              {l.duration_label && (
                <span className="text-xs text-muted-foreground">{l.duration_label}</span>
              )}
            </li>
          ))}
          {m.lessons.length === 0 && (
            <li className="px-4 py-2.5 text-xs text-muted-foreground">Coming soon.</li>
          )}
        </ul>
      )}
    </div>
  );
}
