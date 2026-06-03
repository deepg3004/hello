"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Plus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createCourseAction } from "@/actions/courses";

export interface CourseRow {
  id: string;
  title: string;
  status: "draft" | "published";
  created_at: string;
}

interface Stats {
  total: number;
  published: number;
  students: number;
}

export function CoursesClient({
  courses,
  stats,
}: {
  courses: CourseRow[];
  stats: Stats;
}) {
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
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Courses" value={stats.total} tile="tile-indigo" Icon={BookOpen} />
        <Stat label="Published" value={stats.published} tile="tile-emerald" Icon={CheckCircle2} />
        <Stat label="Students" value={stats.students} tile="tile-violet" Icon={Users} />
      </div>

      {/* Create */}
      <div className="card-surface p-4">
        {open ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
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

      {/* Grid */}
      {courses.length === 0 ? (
        <div className="card-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
            <GraduationCap className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            No courses yet. Create one and link it to a product so buyers get
            access on purchase.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/courses/${c.id}`}
              className="card-surface group block p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg tile-indigo">
                  <BookOpen className="h-4 w-4" />
                </div>
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
              <h3 className="mt-3 font-sora font-semibold tracking-tight group-hover:text-primary">
                {c.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">Edit course →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tile,
  Icon,
}: {
  label: string;
  value: number;
  tile: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tile)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="font-sora text-lg font-bold tabular-nums">
          {value.toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}
