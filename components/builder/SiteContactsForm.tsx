"use client";

// Site-wide contact channels — entered once here, then used by the floating
// chat button (and, on the public page, the header/footer/bottom bar). Loads
// + saves via /api/builder/sites/me (contacts_json).

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FloatingChat, type SiteContacts } from "@/components/builder/FloatingChat";

const FIELDS: Array<{ key: keyof SiteContacts; label: string; placeholder: string }> = [
  { key: "telegram", label: "Telegram", placeholder: "@handle or https://t.me/…" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "9198xxxxxxx or https://wa.me/…" },
  { key: "phone", label: "Phone", placeholder: "+91 98xxxxxxx" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
];

export function SiteContactsForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<SiteContacts>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/builder/sites/me");
        const data = (await res.json()) as { site?: { contacts_json?: SiteContacts } };
        if (alive) setContacts(data.site?.contacts_json ?? {});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/builder/sites/me", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contacts_json: contacts }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast({ title: "Contacts saved" });
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{f.label}</span>
            <input
              value={contacts[f.key] ?? ""}
              onChange={(e) => setContacts((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        WhatsApp + Telegram show as a floating chat button on your site (previewed bottom-right).
      </p>
      <Button onClick={save} disabled={saving} size="sm">
        {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
        Save contacts
      </Button>

      {/* Live preview of the floating chat */}
      <FloatingChat contacts={contacts} />
    </div>
  );
}
