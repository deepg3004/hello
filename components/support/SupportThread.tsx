import { format } from "date-fns";

import { cn } from "@/lib/utils";

export interface SupportMessage {
  id: string;
  direction: string; // 'inbound' (from the customer) | 'outbound' (from support)
  body: string;
  createdAt: string;
}

/** Pure render of a ticket message thread, shared by the seller + admin views.
 *  Labels differ per viewer: a seller sees their own messages as "You"; an
 *  admin sees the customer's inbound messages by name and their own as "You". */
export function SupportThread({
  messages,
  inboundLabel = "You",
  outboundLabel = "Support",
}: {
  messages: SupportMessage[];
  inboundLabel?: string;
  outboundLabel?: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }
  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const fromSupport = m.direction === "outbound";
        return (
          <div
            key={m.id}
            className={cn("flex", fromSupport ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                fromSupport
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  fromSupport ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {fromSupport ? outboundLabel : inboundLabel} ·{" "}
                {format(new Date(m.createdAt), "d MMM, HH:mm")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
