"use client";

import { useEffect, useState } from "react";

import { SupportThread, type SupportMessage } from "./SupportThread";

/** Live-updating support thread — short-polls /api/support/[id]/messages so new
 *  replies from the other side appear without a manual refresh. Pauses while the
 *  tab is hidden. Falls back to the server-rendered initialMessages. */
export function LiveSupportThread({
  ticketId,
  initialMessages,
  inboundLabel,
  outboundLabel,
  intervalMs = 4000,
}: {
  ticketId: string;
  initialMessages: SupportMessage[];
  inboundLabel?: string;
  outboundLabel?: string;
  intervalMs?: number;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (typeof document !== "undefined" && document.hidden) {
        schedule();
        return;
      }
      try {
        const res = await fetch(`/api/support/${ticketId}/messages`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { messages?: SupportMessage[] };
          if (active && Array.isArray(body.messages)) setMessages(body.messages);
        }
      } catch {
        /* transient — keep polling */
      }
      schedule();
    }
    function schedule() {
      timer = setTimeout(poll, intervalMs);
    }

    schedule();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ticketId, intervalMs]);

  return (
    <SupportThread
      messages={messages}
      inboundLabel={inboundLabel}
      outboundLabel={outboundLabel}
    />
  );
}
