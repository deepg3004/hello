"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { saveSiteSettingsAction } from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
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
  footer_columns: Array<{ title: string; links: FooterLink[] }>;
}

/** Website-wide settings: footer text/links, favicon and social share image. */
export function SiteSettingsForm({ initial }: { initial: SiteSettingsInitial }) {
  const router = useRouter();
  const { toast } = useToast();

  const [footerText, setFooterText] = useState(initial.footer_text);
  const [favicon, setFavicon] = useState(initial.favicon);
  const [ogImage, setOgImage] = useState(initial.og_image);
  const [links, setLinks] = useState<FooterLink[]>(initial.footer_links ?? []);
  const [columns, setColumns] = useState<Array<{ title: string; linksText: string }>>(
    (initial.footer_columns ?? []).map((c) => ({
      title: c.title,
      linksText: c.links.map((l) => `${l.label} | ${l.url}`).join("\n"),
    })),
  );
  const [saving, setSaving] = useState(false);

  const updateLink = (i: number, patch: Partial<FooterLink>) =>
    setLinks(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLink = () => setLinks([...links, { label: "", url: "" }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));

  const updateCol = (i: number, patch: Partial<{ title: string; linksText: string }>) =>
    setColumns(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCol = () => setColumns([...columns, { title: "", linksText: "" }]);
  const removeCol = (i: number) => setColumns(columns.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true);
    const r = await saveSiteSettingsAction({
      footer_text: footerText,
      favicon,
      og_image: ogImage,
      footer_links: links,
      footer_columns: columns.map((c) => ({
        title: c.title,
        links: c.linksText
          .split("\n")
          .map((line) => {
            const [label, url] = line.split("|").map((x) => x.trim());
            return { label: label ?? "", url: url ?? "" };
          })
          .filter((l) => l.label && l.url),
      })),
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
          <Label className="text-sm font-medium">Favicon</Label>
          <ImageUpload value={favicon} onChange={setFavicon} placeholder="32×32 PNG/ICO" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Social share image (OG)</Label>
          <ImageUpload value={ogImage} onChange={setOgImage} placeholder="1200×630 share image" />
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

      <div className="space-y-2 border-t pt-4">
        <Label className="text-sm font-medium">Footer columns (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Multi-column footer. One link per line as <code>Label | URL</code>.
        </p>
        {columns.map((c, i) => (
          <div key={i} className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={c.title}
                onChange={(e) => updateCol(i, { title: e.target.value })}
                placeholder="Column title (e.g. Company)"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => removeCol(i)}
                aria-label="Remove column"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              value={c.linksText}
              onChange={(e) => updateCol(i, { linksText: e.target.value })}
              rows={4}
              placeholder={"About | /about\nContact | /contact"}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addCol}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add footer column
        </Button>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save settings
      </Button>
    </div>
  );
}
