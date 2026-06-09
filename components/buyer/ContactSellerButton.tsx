"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { contactSellerAboutOrderAction } from "@/actions/buyer-account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const TOPICS: { value: string; label: string }[] = [
  { value: "question", label: "Question about my order" },
  { value: "refund", label: "Refund request" },
  { value: "delivery", label: "Delivery / access issue" },
  { value: "other", label: "Something else" },
];

/** Buyer → seller message dialog on an order card. Relays an email to the
 *  seller (reply-to the buyer); no public inbox needed. */
export function ContactSellerButton({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("question");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const r = await contactSellerAboutOrderAction(orderId, topic, message);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Not sent", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Message sent", description: "The seller will reply to your email." });
    setMessage("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
          Contact seller
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact the seller</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Topic</Label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your question or issue…"
            />
            <p className="text-[11px] text-muted-foreground">
              The seller replies straight to your email.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={busy || message.trim().length < 5}>
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
