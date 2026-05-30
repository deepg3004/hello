"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TelegramInviteCardProps {
  inviteLink: string;
  groupName: string;
  buyerEmail: string;
  /** Initial seconds remaining. Defaults to 600 (10 minutes). */
  initialSeconds?: number;
}

/**
 * Post-payment "your invite link is ready" card with a live MM:SS countdown.
 * The countdown is purely a UX nudge — the underlying invite is server-side
 * and remains usable until Telegram itself expires it.
 */
export function TelegramInviteCard({
  inviteLink,
  groupName,
  buyerEmail,
  initialSeconds = 600,
}: TelegramInviteCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const mmss = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  const lowTime = secondsLeft <= 60;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-[#0088cc] bg-white shadow-xl">
      <div
        className="px-6 py-4 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0088cc 0%, #006699 100%)",
        }}
      >
        <p className="flex items-center gap-2 font-sora text-lg font-bold">
          <Send className="h-5 w-5" />
          Your VIP access is ready!
        </p>
        <p className="mt-1 text-sm text-white/85">
          Tap the button below to join {groupName} in Telegram.
        </p>
      </div>

      <div className="px-6 py-5">
        <Button
          asChild
          className="w-full bg-[#0088cc] py-6 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-[#0099e0]"
        >
          <a href={inviteLink} target="_blank" rel="noreferrer">
            Join {groupName} Now
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>

        <div className="mt-4 flex items-center justify-center">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold",
              lowTime
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-50 text-amber-700",
            )}
          >
            ⏳ Link expires in {mmss}
          </span>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <Mail className="h-3 w-3" />
          Invite link also sent to {buyerEmail}
        </p>

        <p className="mt-3 break-all rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] leading-relaxed text-zinc-500">
          {inviteLink}
        </p>
      </div>
    </div>
  );
}
