"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Loader2, Plus, RotateCcw, Trash2, Upload } from "lucide-react";

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
  retryMyTranscodeAction,
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
  is_preview: boolean;
  lesson_type: "video" | "text" | "pdf" | "image";
  asset_url: string;
  /** HLS transcode state for video lessons (null = not an HLS upload). */
  transcode_status?: "processing" | "ready" | "failed" | null;
}
export interface EditorModule {
  id: string;
  title: string;
  lessons: EditorLesson[];
}
export interface EditorCourse {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail_url: string;
  status: "draft" | "published";
  product_id: string;
  category: string;
  level: string;
  language: string;
  what_you_learn: string[];
  requirements: string[];
  who_for: string[];
  instructor_name: string;
  instructor_bio: string;
  instructor_avatar: string;
  promo_video_url: string;
  /** HLS transcode state for an uploaded promo video (null otherwise). */
  promo_transcode_status?: "processing" | "ready" | "failed" | null;
  offer_config: {
    enabled: boolean;
    title: string;
    text: string;
    cta_label: string;
    cta_url: string;
  } | null;
}

const LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"];

function linesToList(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
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
  const [subtitle, setSubtitle] = useState(course.subtitle);
  const [description, setDescription] = useState(course.description);
  const [thumb, setThumb] = useState(course.thumbnail_url);
  const [status, setStatus] = useState(course.status);
  const [productId, setProductId] = useState(course.product_id);
  const [newModule, setNewModule] = useState("");
  const [category, setCategory] = useState(course.category);
  const [level, setLevel] = useState(course.level);
  const [language, setLanguage] = useState(course.language || "English");
  const [learn, setLearn] = useState(course.what_you_learn.join("\n"));
  const [requirements, setRequirements] = useState(course.requirements.join("\n"));
  const [whoFor, setWhoFor] = useState(course.who_for.join("\n"));
  const [instrName, setInstrName] = useState(course.instructor_name);
  const [instrBio, setInstrBio] = useState(course.instructor_bio);
  const [instrAvatar, setInstrAvatar] = useState(course.instructor_avatar);
  const [promo, setPromo] = useState(course.promo_video_url);
  const [offerOn, setOfferOn] = useState(course.offer_config?.enabled ?? false);
  const [offerTitle, setOfferTitle] = useState(course.offer_config?.title ?? "");
  const [offerText, setOfferText] = useState(course.offer_config?.text ?? "");
  const [offerCtaLabel, setOfferCtaLabel] = useState(
    course.offer_config?.cta_label ?? "",
  );
  const [offerCtaUrl, setOfferCtaUrl] = useState(
    course.offer_config?.cta_url ?? "",
  );
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
        subtitle,
        description,
        thumbnail_url: thumb,
        status,
        product_id: productId,
        category,
        level,
        language,
        what_you_learn: linesToList(learn),
        requirements: linesToList(requirements),
        who_for: linesToList(whoFor),
        instructor_name: instrName,
        instructor_bio: instrBio,
        instructor_avatar: instrAvatar,
        promo_video_url: promo,
        offer_config: {
          enabled: offerOn,
          title: offerTitle,
          text: offerText,
          cta_label: offerCtaLabel,
          cta_url: offerCtaUrl,
        },
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
            <Label className="text-xs">Subtitle / headline</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="A one-line promise — what the learner walks away with"
              className="mt-1"
            />
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
          <div>
            <Label className="text-xs">Promo / preview video (YouTube/Vimeo link, direct URL, or upload)</Label>
            <UploadField value={promo} onChange={setPromo} accept="video" />
            <TranscodeStatus status={course.promo_transcode_status ?? null} rawPath={promo} />
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
          <CardTitle className="text-base">Landing page (Udemy-style)</CardTitle>
          <CardDescription>
            These power the public course page. Lists take one item per line.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-40 flex-1">
              <Label className="text-xs">Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Web Development" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Level</Label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="mt-1 block h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <Label className="text-xs">Language</Label>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">What you’ll learn (one per line)</Label>
            <textarea
              value={learn}
              onChange={(e) => setLearn(e.target.value)}
              rows={4}
              placeholder={"Build a REST API from scratch\nDeploy to production\n…"}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Requirements (one per line)</Label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Who this is for (one per line)</Label>
              <textarea
                value={whoFor}
                onChange={(e) => setWhoFor(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Instructor</p>
            <div className="flex flex-wrap gap-4">
              <div className="min-w-48 flex-1">
                <Label className="text-xs">Name</Label>
                <Input value={instrName} onChange={(e) => setInstrName(e.target.value)} placeholder="Defaults to your business name" className="mt-1" />
              </div>
              <div className="w-full">
                <Label className="text-xs">Avatar</Label>
                <UploadField value={instrAvatar} onChange={setInstrAvatar} accept="image" />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs">Bio</Label>
              <textarea
                value={instrBio}
                onChange={(e) => setInstrBio(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <Button onClick={saveCourse} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save landing details
          </Button>
          <p className="text-xs text-muted-foreground">
            Tip: mark a lesson below as a <strong>free preview</strong> so visitors can watch it before buying.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offer popup</CardTitle>
          <CardDescription>
            A promotional popup shown to students on the course player (appears
            a few seconds in, once per session). Leave off to fall back to your
            storefront promo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={offerOn}
              onChange={(e) => setOfferOn(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show an offer popup on this course
          </label>
          <div>
            <Label className="text-xs">Headline</Label>
            <Input
              value={offerTitle}
              onChange={(e) => setOfferTitle(e.target.value)}
              placeholder="Get 30% off my advanced course"
              maxLength={120}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Subtext (optional)</Label>
            <Input
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
              placeholder="Limited-time bundle for current students"
              maxLength={300}
              className="mt-1"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Button label (optional)</Label>
              <Input
                value={offerCtaLabel}
                onChange={(e) => setOfferCtaLabel(e.target.value)}
                placeholder="Claim the offer"
                maxLength={40}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Button link (optional)</Label>
              <Input
                value={offerCtaUrl}
                onChange={(e) => setOfferCtaUrl(e.target.value)}
                placeholder="https://…"
                maxLength={500}
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={saveCourse} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save offer
          </Button>
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
  const [type, setType] = useState<EditorLesson["lesson_type"]>(l.lesson_type);
  const [video, setVideo] = useState(l.video_url);
  const [asset, setAsset] = useState(l.asset_url);
  const [content, setContent] = useState(l.content);
  const [duration, setDuration] = useState(l.duration_label);
  const [isPreview, setIsPreview] = useState(l.is_preview);

  function save() {
    startTransition(async () => {
      const res = await updateLessonAction({
        lessonId: l.id,
        title,
        lesson_type: type,
        video_url: video,
        asset_url: asset,
        content,
        duration_label: duration,
        is_preview: isPreview,
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
        <Label className="text-[11px] text-muted-foreground">Lesson type</Label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EditorLesson["lesson_type"])}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="video">Video</option>
          <option value="text">Text</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
        </select>
      </div>
      {type === "video" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Video (YouTube/Vimeo link, direct URL, or upload)</Label>
          <UploadField value={video} onChange={setVideo} accept="video" />
          <TranscodeStatus status={l.transcode_status ?? null} rawPath={video} />
        </div>
      )}
      {type === "pdf" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">PDF (paste a URL or upload)</Label>
          <UploadField value={asset} onChange={setAsset} accept="pdf" />
        </div>
      )}
      {type === "image" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Image (paste a URL or upload)</Label>
          <UploadField value={asset} onChange={setAsset} accept="image" />
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={type === "text" ? 8 : 2}
        placeholder={type === "text" ? "Write the lesson text here…" : "Lesson notes (optional)"}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPreview}
            onChange={(e) => setIsPreview(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>Free preview — watchable before purchase</span>
        </label>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save lesson
        </Button>
      </div>
    </div>
  );
}

/** Per-lesson HLS transcode state + self-serve retry. Only meaningful for an
 *  uploaded course video (cmedia: path); other URLs render nothing. */
function TranscodeStatus({
  status,
  rawPath,
}: {
  status: "processing" | "ready" | "failed" | null;
  rawPath: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  if (!status || !rawPath.startsWith("cmedia:")) return null;

  async function retry() {
    setRetrying(true);
    const r = await retryMyTranscodeAction(rawPath);
    setRetrying(false);
    if (!r.ok) {
      toast({ variant: "destructive", title: "Couldn't retry", description: r.message });
      return;
    }
    toast({ title: "Re-processing started", description: "Refresh in a minute to see the status." });
    router.refresh();
  }

  if (status === "ready") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Video ready to stream
      </p>
    );
  }
  if (status === "processing") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing video… (you can keep editing)
      </p>
    );
  }
  // failed
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-3.5 w-3.5" /> Video processing failed
      </span>
      <button
        type="button"
        onClick={retry}
        disabled={retrying}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-medium transition hover:bg-muted disabled:opacity-60"
      >
        {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        Retry
      </button>
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
  accept: "image" | "video" | "pdf";
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
        accept={
          accept === "image"
            ? "image/*"
            : accept === "pdf"
              ? "application/pdf,.pdf"
              : "video/*"
        }
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
