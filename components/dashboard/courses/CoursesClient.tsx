"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  Copy,
  Eye,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCourseUrl } from "@/components/dashboard/SellerContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createCourseAction } from "@/actions/courses";

export interface CourseRow {
  id: string;
  title: string;
  status: "draft" | "published";
  students: number;
  lessons: number;
}

export function CoursesClient({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"students" | "lessons" | "name">("students");

  const courseUrl = useCourseUrl();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? courses.filter((c) => c.title.toLowerCase().includes(q))
      : courses;
    const sorted = [...list];
    switch (sort) {
      case "lessons":
        sorted.sort((a, b) => b.lessons - a.lessons);
        break;
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        sorted.sort((a, b) => b.students - a.students);
    }
    return sorted;
  }, [courses, search, sort]);

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

  function copy(url: string) {
    void navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-4">
      {/* Create + (search/sort when many) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {courses.length > 1 ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses"
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="students">Most students</SelectItem>
                <SelectItem value="lessons">Most lessons</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div />
        )}
        {open ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
              className="w-56"
              autoFocus
            />
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
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              No courses yet. Create one and link it to a product so buyers get
              access on purchase.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((c) => {
            const publicLink = courseUrl(c.id);
            return (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg tile-indigo">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">Course</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "published"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                      }
                    >
                      {c.status === "published" ? "Live" : "Draft"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-y py-3 text-center">
                    <div>
                      <div className="text-lg font-semibold">
                        {c.students.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-muted-foreground">Students</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {c.lessons.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-muted-foreground">Lessons</div>
                    </div>
                  </div>

                  {c.status === "published" && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md border bg-muted/40 px-2 py-1 text-xs">
                        {publicLink}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copy(publicLink)}>
                        {copied === publicLink ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/dashboard/courses/${c.id}`}>
                        <Pencil className="mr-1 h-4 w-4" /> Edit
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a
                        href={`/dashboard/courses/${c.id}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye className="mr-1 h-4 w-4" /> Preview
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
