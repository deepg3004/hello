"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { saveBrandingAction } from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export interface BrandingInitial {
  avatar_url: string;
  bio: string;
  tagline: string;
  brand_color: string;
  social_links: Record<string, string>;
}

const SOCIALS = [
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "X / Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "telegram", label: "Telegram" },
  { key: "website", label: "Website" },
];

/** Editable seller branding/profile used across their website. */
export function ProfileBrandingForm({ initial }: { initial: BrandingInitial }) {
  const router = useRouter();
  const { toast } = useToast();

  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [bio, setBio] = useState(initial.bio);
  const [tagline, setTagline] = useState(initial.tagline);
  const [brandColor, setBrandColor] = useState(initial.brand_color || "#6366f1");
  const [socials, setSocials] = useState<Record<string, string>>(
    initial.social_links ?? {},
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await saveBrandingAction({
      avatar_url: avatar,
      bio,
      tagline,
      brand_color: brandColor,
      social_links: socials,
    });
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Branding saved" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Avatar / logo URL">
          <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…/photo.jpg" />
        </Field>
        <Field label="Tagline">
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="What you help people do" />
        </Field>
      </div>

      <Field label="Bio">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="A short intro about you and your work."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>

      <Field label="Brand colour">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
          />
          <Input
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-32 font-mono"
          />
        </div>
      </Field>

      <div>
        <Label className="text-sm font-medium">Social links</Label>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <Input
              key={s.key}
              value={socials[s.key] ?? ""}
              onChange={(e) => setSocials({ ...socials, [s.key]: e.target.value })}
              placeholder={`${s.label} URL or @handle`}
            />
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save branding
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
