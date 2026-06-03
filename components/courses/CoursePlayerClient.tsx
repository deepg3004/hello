"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2, PlayCircle } from "lucide-react";

import { resolvePlaySource } from "@/lib/learn/video";
import { cn } from "@/lib/utils";

export interface PlayerLesson {
  id: string;
  title: string;
  video_url: string | null;
  content: string | null;
  duration_label: string | null;
  completed: boolean;
}
export interface PlayerModule {
  id: string;
  title: string;
  lessons: PlayerLesson[];
}

export function CoursePlayerClient({
  token,
  title,
  description,
  modules,
  preview = false,
}: {
  token: string;
  title: string;
  description: string | null;
  modules: PlayerModule[];
  /** Seller preview — no enrollment; hides progress/mark-complete. */
  preview?: boolean;
}) {
  const flat = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const [done, setDone] = useState<Set<string>>(
    () => new Set(flat.filter((l) => l.completed).map((l) => l.id)),
  );
  const [activeId, setActiveId] = useState<string | null>(flat[0]?.id ?? null);
  const [marking, setMarking] = useState(false);

  const active = flat.find((l) => l.id === activeId) ?? null;
  const source = active ? resolvePlaySource(active.video_url) : null;
  const total = flat.length;
  const completedCount = done.size;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  async function markComplete() {
    if (preview || !active || done.has(active.id)) return;
    setMarking(true);
    try {
      const res = await fetch("/api/courses/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: token, lesson_id: active.id }),
      });
      if (res.ok) {
        setDone((prev) => new Set(prev).add(active.id));
      }
    } catch {
      /* ignore — best-effort */
    } finally {
      setMarking(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {preview ? (
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Preview mode — this is how buyers see your course
          </span>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{total} complete
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Player */}
        <div className="min-w-0">
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            {!source ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/70">
                <PlayCircle className="h-8 w-8" />
                <p className="text-sm">
                  {active ? "No video for this lesson." : "Select a lesson to begin."}
                </p>
              </div>
            ) : source.kind === "file" ? (
              <video src={source.src} controls className="h-full w-full" />
            ) : (
              <iframe
                src={source.src}
                title={active?.title ?? "Lesson"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            )}
          </div>

          {active && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sora text-lg font-semibold">{active.title}</h2>
                {!preview && (
                <button
                  onClick={markComplete}
                  disabled={marking || done.has(active.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                    done.has(active.id)
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-primary text-primary-foreground hover:opacity-90",
                  )}
                >
                  {marking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : done.has(active.id) ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  {done.has(active.id) ? "Completed" : "Mark complete"}
                </button>
                )}
              </div>
              {active.content && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {active.content}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Curriculum */}
        <aside className="space-y-4">
          {modules.map((m) => (
            <div key={m.id} className="card-surface overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
                {m.title}
              </div>
              <ul className="divide-y divide-border">
                {m.lessons.map((l) => {
                  const isDone = done.has(l.id);
                  const isActive = l.id === activeId;
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => setActiveId(l.id)}
                        className={cn(
                          "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-muted/40",
                          isActive && "bg-muted/60",
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{l.title}</span>
                        {l.duration_label && (
                          <span className="text-xs text-muted-foreground">
                            {l.duration_label}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {m.lessons.length === 0 && (
                  <li className="px-4 py-2.5 text-xs text-muted-foreground">
                    No lessons yet.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
