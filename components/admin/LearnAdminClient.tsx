"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  deleteLearnVideoAction,
  reorderLearnVideoAction,
  upsertLearnVideoAction,
  type LearnSection,
} from "@/actions/learn";
import { updateSettingAction } from "@/actions/admin";
import { MediaInput } from "@/components/admin/MediaInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { deriveThumb } from "@/lib/learn/video";

export interface AdminLearnVideo {
  id: string;
  section: LearnSection;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_label: string | null;
  badge_label: string | null;
  cta_label: string | null;
  is_published: boolean;
}

interface Props {
  settings: Record<string, string>;
  featured: AdminLearnVideo | null;
  useInvoxai: AdminLearnVideo[];
  niche: AdminLearnVideo[];
}

export function LearnAdminClient({ settings, featured, useInvoxai, niche }: Props) {
  return (
    <div className="space-y-6">
      <HeroForm settings={settings} />
      <ResourcesForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Featured masterclass</CardTitle>
          <CardDescription>
            The large card under &ldquo;Essentials&rdquo;. Shows a red badge + CTA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoEditor section="featured" video={featured} startOpen withBadgeCta />
        </CardContent>
      </Card>

      <VideoSection
        title="Learn how to use invoxai"
        section="use_invoxai"
        videos={useInvoxai}
      />
      <VideoSection
        title="Earning money in your niche"
        section="niche"
        videos={niche}
      />
    </div>
  );
}

// ── Hero settings ───────────────────────────────────────────────────────────
function HeroForm({ settings }: { settings: Record<string, string> }) {
  const { toast } = useToast();
  const router = useRouter();
  const [label, setLabel] = useState(settings.learn_hero_label ?? "");
  const [heading, setHeading] = useState(settings.learn_hero_heading ?? "");
  const [image, setImage] = useState(settings.learn_hero_image_url ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await Promise.all([
      updateSettingAction("learn_hero_label", label),
      updateSettingAction("learn_hero_heading", heading),
      updateSettingAction("learn_hero_image_url", image),
    ]);
    setSaving(false);
    const bad = res.find((r) => !r.ok);
    if (bad) {
      toast({ variant: "destructive", title: "Couldn't save", description: bad.message });
      return;
    }
    toast({ title: "Hero saved" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hero banner</CardTitle>
        <CardDescription>The dark banner at the top of the Learn page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Micro-label (with 🎓)">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Heading">
          <Textarea rows={2} value={heading} onChange={(e) => setHeading(e.target.value)} />
        </Field>
        <Field label="Background image (optional — dark overlay is applied)">
          <MediaInput value={image} onChange={setImage} accept="image" />
        </Field>
        <SaveButton onClick={save} saving={saving} />
      </CardContent>
    </Card>
  );
}

// ── Resources card settings ─────────────────────────────────────────────────
function ResourcesForm({ settings }: { settings: Record<string, string> }) {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState(settings.learn_resources_title ?? "");
  const [bullets, setBullets] = useState(settings.learn_resources_bullets ?? "");
  const [ctaLabel, setCtaLabel] = useState(settings.learn_resources_cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(settings.learn_resources_cta_url ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await Promise.all([
      updateSettingAction("learn_resources_title", title),
      updateSettingAction("learn_resources_bullets", bullets),
      updateSettingAction("learn_resources_cta_label", ctaLabel),
      updateSettingAction("learn_resources_cta_url", ctaUrl),
    ]);
    setSaving(false);
    const bad = res.find((r) => !r.ok);
    if (bad) {
      toast({ variant: "destructive", title: "Couldn't save", description: bad.message });
      return;
    }
    toast({ title: "Resources card saved" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resources card</CardTitle>
        <CardDescription>The amber/dark card beside the masterclass.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Heading">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Bullets (one per line)">
          <Textarea rows={3} value={bullets} onChange={(e) => setBullets(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Button label">
            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </Field>
          <Field label="Button link (URL)">
            <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <SaveButton onClick={save} saving={saving} />
      </CardContent>
    </Card>
  );
}

// ── A carousel section (list of editors + add) ──────────────────────────────
function VideoSection({
  title,
  section,
  videos,
}: {
  title: string;
  section: LearnSection;
  videos: AdminLearnVideo[];
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{videos.length} video(s)</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add video
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <VideoEditor
            section={section}
            video={null}
            startOpen
            isNew
            onDone={() => setAdding(false)}
          />
        )}
        {videos.length === 0 && !adding ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No videos yet — add one.
          </p>
        ) : (
          videos.map((v, i) => (
            <VideoEditor
              key={v.id}
              section={section}
              video={v}
              canMoveUp={i > 0}
              canMoveDown={i < videos.length - 1}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── One video editor (existing or new) ──────────────────────────────────────
function VideoEditor({
  section,
  video,
  startOpen = false,
  isNew = false,
  withBadgeCta = false,
  canMoveUp = false,
  canMoveDown = false,
  onDone,
}: {
  section: LearnSection;
  video: AdminLearnVideo | null;
  startOpen?: boolean;
  isNew?: boolean;
  withBadgeCta?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(video?.video_url ?? "");
  const [thumb, setThumb] = useState(video?.thumbnail_url ?? "");
  const [duration, setDuration] = useState(video?.duration_label ?? "");
  const [badge, setBadge] = useState(video?.badge_label ?? "");
  const [cta, setCta] = useState(video?.cta_label ?? "");
  const [published, setPublished] = useState(video?.is_published ?? true);

  // Featured always wants badge/cta/duration; carousels show them too (optional).
  const showBadgeCta = withBadgeCta || section === "featured";
  const preview = deriveThumb(videoUrl, thumb);

  function save() {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title is required" });
      return;
    }
    startTransition(async () => {
      const res = await upsertLearnVideoAction({
        id: video?.id,
        section,
        title,
        description,
        video_url: videoUrl,
        thumbnail_url: thumb,
        duration_label: duration,
        badge_label: badge,
        cta_label: cta,
        is_published: published,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Save failed", description: res.message });
        return;
      }
      toast({ title: "Saved" });
      if (isNew) {
        setTitle("");
        setDescription("");
        setVideoUrl("");
        setThumb("");
        onDone?.();
      }
      router.refresh();
    });
  }

  function remove() {
    if (!video?.id) return;
    if (!confirm("Delete this video?")) return;
    startTransition(async () => {
      const res = await deleteLearnVideoAction(video.id);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Delete failed", description: res.message });
        return;
      }
      toast({ title: "Deleted" });
      router.refresh();
    });
  }

  function move(dir: "up" | "down") {
    if (!video?.id) return;
    startTransition(async () => {
      await reorderLearnVideoAction(video.id, dir);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Collapsed header row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-9 w-16 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-9 w-16 shrink-0 rounded bg-muted" />
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium">
            {title || (isNew ? "New video" : "Untitled")}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {published ? "Published" : "Hidden"}
            {duration ? ` · ${duration}` : ""}
          </p>
        </button>
        {!isNew && video?.id && (
          <div className="flex items-center gap-1">
            <IconBtn label="Move up" disabled={!canMoveUp || pending} onClick={() => move("up")}>
              <ChevronUp className="h-4 w-4" />
            </IconBtn>
            <IconBtn
              label="Move down"
              disabled={!canMoveDown || pending}
              onClick={() => move("down")}
            >
              <ChevronDown className="h-4 w-4" />
            </IconBtn>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Video (YouTube/Vimeo URL or upload MP4)">
            <MediaInput value={videoUrl} onChange={setVideoUrl} accept="video" placeholder="https://youtube.com/… or upload" />
          </Field>
          <Field label="Thumbnail (optional — auto-pulled from YouTube if blank)">
            <MediaInput value={thumb} onChange={setThumb} accept="image" />
          </Field>
          {showBadgeCta ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Duration">
                <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="56 mins" />
              </Field>
              <Field label="Badge">
                <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="NOW AVAILABLE" />
              </Field>
              <Field label="Button label">
                <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Start watching" />
              </Field>
            </div>
          ) : (
            <Field label="Duration (optional)">
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 8 mins" />
            </Field>
          )}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={published} onCheckedChange={setPublished} />
              Published
            </label>
            <div className="flex items-center gap-2">
              {!isNew && video?.id && (
                <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
              <Button type="button" size="sm" onClick={save} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── small shared bits ───────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <Button type="button" size="sm" onClick={onClick} disabled={saving}>
      {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
      Save
    </Button>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}
