"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { saveSiteAppearanceAction } from "@/actions/site";
import { SITE_THEME_LIST, DEFAULT_SITE_THEME, SITE_FONTS } from "@/lib/site-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/** Theme palette + font picker for the seller's website. */
export function AppearanceForm({
  initialTheme,
  initialFont,
}: {
  initialTheme: string | null;
  initialFont: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [theme, setTheme] = useState(initialTheme || DEFAULT_SITE_THEME);
  const [font, setFont] = useState(initialFont || "sans");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await saveSiteAppearanceAction({ theme, font });
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Theme saved" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SITE_THEME_LIST.map((t) => {
          const selected = theme === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              className={`relative overflow-hidden rounded-xl border p-3 text-left transition ${
                selected ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30"
              }`}
              style={{ background: t.bg }}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full" style={{ background: t.accent }} />
                <span
                  className="h-2 w-10 rounded-full"
                  style={{ background: t.fgMuted, opacity: 0.6 }}
                />
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: t.fg }}>
                {t.label}
              </p>
              <p className="text-[11px]" style={{ color: t.fgDim }}>
                {t.dark ? "Dark" : "Light"}
              </p>
              {selected && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="max-w-xs space-y-1.5">
        <Label className="text-sm font-medium">Font</Label>
        <select
          value={font}
          onChange={(e) => setFont(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {SITE_FONTS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        Your brand colour (set above) overrides the theme accent on your site.
      </p>
      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save theme
      </Button>
    </div>
  );
}
