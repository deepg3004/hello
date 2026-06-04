"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { addSupportReplyAction } from "@/actions/support";

export function SupportReply({ ticketId }: { ticketId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  function send() {
    start(async () => {
      const res = await addSupportReplyAction({ ticketId, body });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Couldn't send", description: res.message });
      }
    });
  }

  return (
    <div className="card-surface space-y-3 p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write a reply…"
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      <Button onClick={send} disabled={pending || !body.trim()}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send reply
      </Button>
    </div>
  );
}
