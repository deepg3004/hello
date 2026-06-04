"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { saveSiteSettingsAction } from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface FooterLink {
  label: string;
  url: string;
}

export interface SiteSettingsInitial {
  footer_text: string;
  favicon: string;
  og_image: string;
  footer_links: FooterLink[];
}

/** Website-wide settings: footer text/links, favicon and social share image. */
export function SiteSettingsForm({ initial }: { initial: SiteSettingsInitial }) {
  const router = useRouter();
  const { toast } = useToast();

  const [footerText, setFooterText] = useState(initial.footer_text);
  const [favicon, setFavicon] = useState(initial.favicon);
  const [ogImage, setOgImage] = useState(initial.og_image);
  const [links, setLinks] = useState<FooterLink[]>(initial.footer_links ?? []);
  const [saving, setSaving] = useState(false);

  const updateLink = (i: number, patch: Partial<FooterLink>) =>
    setLinks(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLink = () => setLinks([...links, { label: "", url: "" }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true);
    const r = await saveSiteSettingsAction({
      footer_text: footerText,
      favicon,
      og_image: ogImage,
      footer_links: links,
    });
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Favicon URL</Label>
          <Input value={favicon} onChange={(e) => setFavicon(e.target.value)} placeholder="https://…/favicon.png" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Social share image (OG)</Label>
          <Input value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://…/share.png" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Footer text</Label>
        <Input
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          placeholder="© Your Brand. All rights reserved."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Footer links</Label>
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={l.label}
              onChange={(e) => updateLink(i, { label: e.target.value })}
              placeholder="Label"
              className="w-40"
            />
            <Input
              value={l.url}
              onChange={(e) => updateLink(i, { url: e.target.value })}
              placeholder="https://… or /slug"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={() => removeLink(i)}
              aria-label="Remove link"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addLink}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add footer link
        </Button>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save settings
      </Button>
    </div>
  );
}
