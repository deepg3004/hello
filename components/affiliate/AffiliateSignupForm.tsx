"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Props {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  commissionLine: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AffiliateSignupForm({
  pageId,
  pageSlug,
  commissionLine,
}: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pitch, setPitch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | {
    code: string;
    link: string;
  }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !EMAIL_RE.test(email)) {
      toast({
        variant: "destructive",
        title: "Check your details",
        description: "Name + valid email required.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          pitch: pitch.trim() || undefined,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        referral_code?: string;
        referral_url?: string;
      };
      if (!res.ok || !body.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't sign you up",
          description: body.error,
        });
        return;
      }
      setDone({
        code: body.referral_code ?? "",
        link: body.referral_url ?? "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      /* fall through */
    }
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-md border bg-emerald-50/40 p-4 text-sm dark:bg-emerald-900/10">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="font-medium">You&apos;re in 🎉</p>
        </div>
        <p className="text-muted-foreground">
          Your unique referral link. Every sale that comes through it earns
          you <strong>{commissionLine}</strong>. We just emailed you a copy.
        </p>
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">Your referral link</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-xs">{done.link}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(done.link, "Referral link")}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <a href={`/p/${pageSlug}`} target="_blank" rel="noreferrer">
              View the page
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
          <Button asChild variant="ghost">
            <a href="/affiliate/portal">Open my portal →</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <Label className="text-xs">Your name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
        />
      </div>
      <div>
        <Label className="text-xs">Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Used for your referral link + payouts. We&apos;ll OTP-login you to
          the portal — no password to remember.
        </p>
      </div>
      <div>
        <Label className="text-xs">Phone (optional)</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+91 98765 43210"
        />
      </div>
      <div>
        <Label className="text-xs">Why do you want to promote this?</Label>
        <Textarea
          rows={3}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="A line or two — the seller reads this when approving affiliates."
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Get my referral link
      </Button>
    </form>
  );
}
