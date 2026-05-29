"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Send, X } from "lucide-react";

import {
  addLeadNoteAction,
  addLeadTagsAction,
  removeLeadTagAction,
  sendManualEmailAction,
} from "@/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { LeadRow } from "./LeadsTable";

interface LeadDetailDrawerProps {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailDrawer({ lead, open, onOpenChange }: LeadDetailDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!lead) return null;

  async function addTags() {
    if (!lead) return;
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    setBusy("tag");
    const r = await addLeadTagsAction(lead.id, tags);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't add tags", description: r.message, variant: "destructive" });
      return;
    }
    setTagInput("");
    router.refresh();
  }

  async function removeTag(tag: string) {
    if (!lead) return;
    setBusy("tag-" + tag);
    const r = await removeLeadTagAction(lead.id, tag);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't remove", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  async function addNote() {
    if (!lead) return;
    if (!noteInput.trim()) return;
    setBusy("note");
    const r = await addLeadNoteAction(lead.id, noteInput);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't add note", description: r.message, variant: "destructive" });
      return;
    }
    setNoteInput("");
    router.refresh();
  }

  async function sendEmail() {
    if (!lead) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ title: "Subject and body required", variant: "destructive" });
      return;
    }
    setBusy("email");
    const r = await sendManualEmailAction(lead.id, emailSubject, emailBody);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Send failed", description: r.message, variant: "destructive" });
      return;
    }
    setEmailSubject("");
    setEmailBody("");
    toast({ title: "Email sent" });
  }

  const customFields = (lead.custom_fields ?? {}) as Record<string, unknown>;
  const customEntries = Object.entries(customFields).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{lead.name ?? lead.email}</SheetTitle>
          <SheetDescription>{lead.email}</SheetDescription>
          {lead.phone && (
            <p className="mt-1 text-xs text-muted-foreground">{lead.phone}</p>
          )}
        </SheetHeader>
        <Tabs defaultValue="details" className="flex-1 overflow-hidden">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="notes">Notes ({lead.notes.length})</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent
            value="details"
            className="space-y-5 overflow-y-auto px-6 pb-6 pt-3"
          >
            <Section title="Source">
              <KV k="Page" v={lead.page_title ?? "—"} />
              <KV k="Captured" v={format(new Date(lead.created_at), "d MMM yyyy, HH:mm")} />
              {lead.source && <KV k="Source" v={lead.source} />}
              {lead.confirmed_at && (
                <KV k="Confirmed" v={format(new Date(lead.confirmed_at), "d MMM yyyy")} />
              )}
              {lead.delivered_magnet && <KV k="Lead magnet" v="Delivered" />}
            </Section>

            {customEntries.length > 0 && (
              <Section title="Custom fields">
                {customEntries.map(([k, v]) => (
                  <KV key={k} k={k} v={String(v)} />
                ))}
              </Section>
            )}

            <Section title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags yet.</span>
                )}
                {lead.tags.map((t) => (
                  <Badge key={t} variant="outline" className="gap-1">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${t}`}
                    >
                      {busy === "tag-" + t ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="hot-lead, ebook, …"
                />
                <Button size="sm" onClick={addTags} disabled={busy === "tag"}>
                  {busy === "tag" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Add
                </Button>
              </div>
            </Section>

            {lead.utm && Object.keys(lead.utm).length > 0 && (
              <Section title="UTM">
                {Object.entries(lead.utm).map(([k, v]) => (
                  <KV key={k} k={k} v={String(v)} />
                ))}
              </Section>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-3 overflow-y-auto px-6 pb-6 pt-3">
            <div className="space-y-2">
              <Label>Add a note</Label>
              <Textarea
                rows={3}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Anything you want to remember about this lead…"
              />
              <Button size="sm" onClick={addNote} disabled={busy === "note" || !noteInput.trim()}>
                {busy === "note" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Save note
              </Button>
            </div>
            <div className="space-y-2 pt-3">
              {lead.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                lead.notes.map((n, i) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(n.at), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-3 overflow-y-auto px-6 pb-6 pt-3">
            <div>
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Plain text. Line breaks preserved."
              />
            </div>
            <Button onClick={sendEmail} disabled={busy === "email"}>
              {busy === "email" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send to {lead.email}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sends via Resend using your configured from address.
            </p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
