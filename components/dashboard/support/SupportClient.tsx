"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createSupportTicketAction } from "@/actions/support";
import { cn } from "@/lib/utils";

export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
}

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function SupportClient({ tickets }: { tickets: SupportTicket[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function submit() {
    start(async () => {
      const res = await createSupportTicketAction({ subject, body });
      if (res.ok) {
        setSubject("");
        setBody("");
        toast({ title: "Ticket sent", description: "We'll reply by email and here." });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Couldn't send", description: res.message });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card-surface space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-sora text-sm font-semibold">
          <MessageSquarePlus className="h-4 w-4" /> New ticket
        </h2>
        <div>
          <Label className="text-xs">Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Message</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Describe the issue…"
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
          />
        </div>
        <Button onClick={submit} disabled={pending || !subject.trim() || !body.trim()}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send ticket
        </Button>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-sora text-sm font-semibold">Your tickets</h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/support/${t.id}`}
                className="flex items-center justify-between gap-3 py-3 transition hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.lastMessageAt), "d MMM yyyy")}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_TONE[t.status] ?? "bg-muted text-muted-foreground")}>
                  {t.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
