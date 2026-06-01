"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { sendTestEmailAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { MailboxRole } from "@/lib/emails/routing";

interface Props {
  role: MailboxRole;
}

export function SendTestEmailButton({ role }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const res = await sendTestEmailAction(role);
    setBusy(false);
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Test failed",
        description: res.message,
      });
      return;
    }
    toast({ title: "Test sent", description: res.message });
  }

  return (
    <Button size="sm" variant="outline" onClick={send} disabled={busy} className="gap-1.5">
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      Send test email
    </Button>
  );
}
