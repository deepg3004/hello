"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Loader2, Plus, Trash2, Upload } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSellerOrigin } from "@/components/dashboard/SellerContext";
import {
  addLessonAction,
  addModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  makeCourseSellableAction,
  updateCourseAction,
  updateLessonAction,
  updateModuleAction,
} from "@/actions/courses";

export interface CourseSale {
  price: number;
  originalPrice: number | null;
  salesPath: string | null;
}

export interface EditorLesson {
  id: string;
  title: string;
  video_url: string;
  content: string;
  duration_label: string;
}
export interface EditorModule {
  id: string;
  title: string;
  lessons: EditorLesson[];
}
export interface EditorCourse {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  status: "draft" | "published";
  product_id: string;
}

export function CourseEditor({
  course,
  modules,
  products,
  sale,
}: {
  course: EditorCourse;
  modules: EditorModule[];
  products: { id: string; name: string }[];
  sale: CourseSale | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [thumb, setThumb] = useState(course.thumbnail_url);
  const [status, setStatus] = useState(course.status);
  const [productId, setProductId] = useState(course.product_id);
  const [newModule, setNewModule] = useState("");
  const [price, setPrice] = useState(sale ? String(sale.price) : "");
  const [origPrice, setOrigPrice] = useState(
    sale?.originalPrice ? String(sale.originalPrice) : "",
  );
  const sellerOrigin = useSellerOrigin();
  const base =
    sellerOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  const publicLink = `${base}/course/${course.id}`;

  function makeSellable() {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      toast({ variant: "destructive", title: "Enter a price greater than 0" });
      return;
    }
    startTransition(async () => {
      const res = await makeCourseSellableAction({
        courseId: course.id,
        price: p,
        originalPrice: origPrice ? Number(origPrice) : null,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't update", description: res.message });
        return;
      }
      toast({ title: sale ? "Price updated" : "Course is now sellable 🎉" });
      router.refresh();
    });
  }

  function saveCourse() {
    startTransition(async () => {
      const res = await updateCourseAction({
        id: course.id,
        title,
        description,
        thumbnail_url: thumb,
        status,
        product_id: productId,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: "Course saved" });
      router.refresh();
    });
  }

  function addModule() {
    if (!newModule.trim()) return;
    startTransition(async () => {
      const res = await addModuleAction({ courseId: course.id, title: newModule });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't add module", description: res.message });
        return;
      }
      setNewModule("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </Link>
        <Button asChild variant="outline" size="sm">
          <a href={`/dashboard/courses/${course.id}/preview`} target="_blank" rel="noopener noreferrer">
            <Eye className="mr-1.5 h-4 w-4" /> Preview
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course details</CardTitle>
          <CardDescription>
            Link a product so buyers are enrolled automatically on purchase.
            Publish to make it accessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                className="mt-1 block h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="min-w-56 flex-1">
              <Label className="text-xs">Unlocked by product</Label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Thumbnail</Label>
            <UploadField value={thumb} onChange={setThumb} accept="image" />
          </div>
          <Button onClick={saveCourse} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>

          <div className="border-t pt-4">
            <Label className="text-xs">Public course link (share this)</Label>
            <code className="mt-1 block break-all rounded bg-muted px-3 py-2 text-xs">
              {publicLink}
            </code>
            <p className="mt-1 text-xs text-muted-foreground">
              Live once the course is <strong>Published</strong>. Anyone who opens
              it sees the course landing page; buyers who purchased the linked
              product get the full lessons.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sell this course</CardTitle>
          <CardDescription>
            One click creates a polished sales page + product and links it to
            this course. Buyers are enrolled automatically on purchase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Price (₹)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="999"
                inputMode="decimal"
                className="mt-1 w-32"
              />
            </div>
            <div>
              <Label className="text-xs">Original price (₹, optional)</Label>
              <Input
                value={origPrice}
                onChange={(e) => setOrigPrice(e.target.value)}
                placeholder="1999"
                inputMode="decimal"
                className="mt-1 w-40"
              />
            </div>
            <Button onClick={makeSellable} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sale ? "Update price" : "Make sellable"}
            </Button>
          </div>
          {sale?.salesPath && (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">
                  {base}
                  {sale.salesPath}
                </code>
                <Button asChild variant="outline" size="sm">
                  <a href={`${base}${sale.salesPath}`} target="_blank" rel="noopener noreferrer">
                    View sales page
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This sales page is fully editable in{" "}
                <Link href="/dashboard/pages" className="underline">
                  Pages
                </Link>
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Modules &amp; lessons</h2>
        {modules.map((m) => (
          <ModuleBlock key={m.id} module={m} />
        ))}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 pt-6">
            <div className="flex-1 min-w-48">
              <Label className="text-xs">New module</Label>
              <Input
                value={newModule}
                onChange={(e) => setNewModule(e.target.value)}
                placeholder="Module title"
                className="mt-1"
              />
            </div>
            <Button variant="outline" onClick={addModule} disabled={pending}>
              <Plus className="mr-1 h-4 w-4" /> Add module
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ModuleBlock({ module: m }: { module: EditorModule }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(m.title);
  const [newLesson, setNewLesson] = useState("");

  function renameModule() {
    startTransition(async () => {
      const res = await updateModuleAction({ moduleId: m.id, title });
      if (!res.ok) toast({ variant: "destructive", title: "Couldn't rename", description: res.message });
      else router.refresh();
    });
  }
  function removeModule() {
    startTransition(async () => {
      await deleteModuleAction(m.id);
      router.refresh();
    });
  }
  function addLesson() {
    if (!newLesson.trim()) return;
    startTransition(async () => {
      const res = await addLessonAction({ moduleId: m.id, title: newLesson });
      if (!res.ok) toast({ variant: "destructive", title: "Couldn't add", description: res.message });
      else {
        setNewLesson("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-48">
            <Label className="text-xs">Module title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <Button variant="outline" size="sm" onClick={renameModule} disabled={pending}>
            Save
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete module" onClick={removeModule} disabled={pending}>
            <Trash2 className="h-4 w-4 text-rose-500" />
          </Button>
        </div>

        <div className="space-y-3 border-l-2 border-border pl-3">
          {m.lessons.map((l) => (
            <LessonBlock key={l.id} lesson={l} />
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48">
              <Input
                value={newLesson}
                onChange={(e) => setNewLesson(e.target.value)}
                placeholder="New lesson title"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addLesson} disabled={pending}>
              <Plus className="mr-1 h-4 w-4" /> Add lesson
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LessonBlock({ lesson: l }: { lesson: EditorLesson }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(l.title);
  const [video, setVideo] = useState(l.video_url);
  const [content, setContent] = useState(l.content);
  const [duration, setDuration] = useState(l.duration_label);

  function save() {
    startTransition(async () => {
      const res = await updateLessonAction({
        lessonId: l.id,
        title,
        video_url: video,
        content,
        duration_label: duration,
      });
      if (!res.ok) toast({ variant: "destructive", title: "Couldn't save", description: res.message });
      else {
        toast({ title: "Lesson saved" });
        router.refresh();
      }
    });
  }
  function remove() {
    startTransition(async () => {
      await deleteLessonAction(l.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
        <Input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="12 min"
          className="w-24"
        />
        <Button variant="ghost" size="icon" aria-label="Delete lesson" onClick={remove} disabled={pending}>
          <Trash2 className="h-4 w-4 text-rose-500" />
        </Button>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Video (YouTube/Vimeo link or upload)</Label>
        <UploadField value={video} onChange={setVideo} accept="video" />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Lesson notes (optional)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button size="sm" onClick={save} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save lesson
      </Button>
    </div>
  );
}

function UploadField({
  value,
  onChange,
  accept,
}: {
  value: string;
  onChange: (url: string) => void;
  accept: "image" | "video";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/courses/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast({ variant: "destructive", title: "Upload failed", description: json.error });
      } else {
        onChange(json.url);
        toast({ title: "Uploaded" });
      }
    } catch {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-1 flex gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste a URL or upload" />
      <input
        ref={fileRef}
        type="file"
        accept={accept === "image" ? "image/*" : "video/*"}
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
    </div>
  );
}
