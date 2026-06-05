"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { sendBroadcastAction } from "@/actions/broadcast";

export function BroadcastForm() {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"sellers" | "admins">("sellers");

  function send() {
    if (!confirm(`Send this announcement to all ${audience}? This can't be undone.`)) return;
    start(async () => {
      const res = await sendBroadcastAction({ title, body, link, audience });
      if (res.ok) {
        setTitle("");
        setBody("");
        setLink("");
        toast({ title: "Broadcast sent", description: `Delivered to ${res.sent?.toLocaleString("en-IN")} recipients.` });
      } else {
        toast({ variant: "destructive", title: "Couldn't send", description: res.message });
      }
    });
  }

  return (
    <div className="card-surface max-w-xl space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance tonight" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Message (optional)</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Add detail…"
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Link (optional)</Label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/dashboard/wallet" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Audience</Label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as "sellers" | "admins")}
            className="mt-1 block h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="sellers">All sellers</option>
            <option value="admins">Admins only</option>
          </select>
        </div>
      </div>
      <Button onClick={send} disabled={pending || !title.trim()}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Send broadcast
      </Button>
    </div>
  );
}
