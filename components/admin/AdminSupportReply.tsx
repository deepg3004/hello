"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { replySupportTicketAction, setTicketStatusAction } from "@/actions/support";
import { cn } from "@/lib/utils";

const STATUSES: { key: "open" | "in_progress" | "resolved"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
];

export function AdminSupportReply({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  function send() {
    start(async () => {
      const res = await replySupportTicketAction({ ticketId, body });
      if (res.ok) {
        setBody("");
        toast({ title: "Reply sent", description: "Emailed the customer + posted to their dashboard." });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Couldn't send", description: res.message });
      }
    });
  }

  function setStatus(next: "open" | "in_progress" | "resolved") {
    start(async () => {
      const res = await setTicketStatusAction({ ticketId, status: next });
      if (res.ok) router.refresh();
      else toast({ variant: "destructive", title: "Couldn't update", description: res.message });
    });
  }

  return (
    <div className="card-surface space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={pending}
            onClick={() => setStatus(s.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
              status === s.key
                ? "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300"
                : "border border-border bg-card text-muted-foreground ring-transparent hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Reply to the customer…"
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      <Button onClick={send} disabled={pending || !body.trim()}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send reply
      </Button>
    </div>
  );
}
