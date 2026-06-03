import { Lock, PlayCircle } from "lucide-react";

import { formatINR } from "@/lib/utils";

export interface LandingModule {
  id: string;
  title: string;
  lessons: { id: string; title: string; duration_label: string | null }[];
}

/**
 * Public, shareable course landing page (shown at /course/[id] to anyone
 * without a valid access token). Curriculum is preview-only (locked); the CTA
 * links to the linked product's checkout.
 */
export function CourseLanding({
  title,
  description,
  sellerName,
  thumbnailUrl,
  modules,
  priceRupees,
  originalPriceRupees,
  checkoutUrl,
}: {
  title: string;
  description: string | null;
  sellerName: string | null;
  thumbnailUrl: string | null;
  modules: LandingModule[];
  priceRupees: number | null;
  originalPriceRupees: number | null;
  checkoutUrl: string | null;
}) {
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Left — overview + curriculum */}
        <div className="min-w-0">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={title}
              className="mb-6 aspect-[16/9] w-full rounded-xl border object-cover"
            />
          ) : (
            <div className="mb-6 aspect-[16/9] w-full rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100" />
          )}
          <h1 className="font-sora text-3xl font-bold tracking-tight">{title}</h1>
          {sellerName && (
            <p className="mt-1 text-sm text-muted-foreground">by {sellerName}</p>
          )}
          {description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}

          <h2 className="mt-8 font-sora text-lg font-semibold">
            Course content
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {modules.length} module{modules.length === 1 ? "" : "s"} · {lessonCount}{" "}
              lesson{lessonCount === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="mt-3 space-y-3">
            {modules.map((m) => (
              <div key={m.id} className="card-surface overflow-hidden">
                <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
                  {m.title}
                </div>
                <ul className="divide-y divide-border">
                  {m.lessons.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground"
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 truncate">{l.title}</span>
                      {l.duration_label && (
                        <span className="text-xs">{l.duration_label}</span>
                      )}
                    </li>
                  ))}
                  {m.lessons.length === 0 && (
                    <li className="px-4 py-2.5 text-xs text-muted-foreground">
                      Coming soon.
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Right — purchase card */}
        <aside>
          <div className="card-surface sticky top-6 p-5">
            <div className="flex items-baseline gap-2">
              {priceRupees != null ? (
                <>
                  <span className="font-sora text-3xl font-bold">
                    {formatINR(Math.round(priceRupees * 100))}
                  </span>
                  {originalPriceRupees != null && originalPriceRupees > priceRupees && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatINR(Math.round(originalPriceRupees * 100))}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-sora text-2xl font-bold">Enroll</span>
              )}
            </div>
            {checkoutUrl ? (
              <a
                href={checkoutUrl}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <PlayCircle className="h-4 w-4" /> Get this course
              </a>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Enrollment opens soon.
              </p>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Instant access after purchase · {lessonCount} lessons
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
