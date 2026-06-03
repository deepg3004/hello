"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createCourseAction } from "@/actions/courses";

export interface CourseRow {
  id: string;
  title: string;
  status: "draft" | "published";
  created_at: string;
}

export function CoursesClient({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);

  function create() {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Enter a course title" });
      return;
    }
    startTransition(async () => {
      const res = await createCourseAction({ title });
      if (!res.ok || !res.id) {
        toast({ variant: "destructive", title: "Couldn't create", description: res.message });
        return;
      }
      router.push(`/dashboard/courses/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-surface p-4">
        {open ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Course title"
                autoFocus
              />
            </div>
            <Button onClick={create} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New course
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="card-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
            <GraduationCap className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            No courses yet. Create one and link it to a product.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/courses/${c.id}`}
              className="card-surface block p-4 transition hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{c.title}</h3>
                <span
                  className={
                    c.status === "published"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground"
                  }
                >
                  {c.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Edit course →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
