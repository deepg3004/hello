"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  saveSellerSmtpAction,
  setSendingDomainAction,
  testSellerSmtpAction,
} from "@/actions/email-integration";

export interface SmtpState {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string | null;
  from_email: string;
  reply_to: string | null;
  active: boolean;
  configured: boolean; // a password is already stored
  sending_domain?: string | null;
}

export function SellerSmtpForm({ initial }: { initial: SmtpState | null }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, setTesting] = useState(false);
  const [s, setS] = useState<SmtpState>(
    initial ?? {
      host: "",
      port: 587,
      secure: false,
      username: "",
      from_name: "",
      from_email: "",
      reply_to: "",
      active: true,
      configured: false,
    },
  );
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState(initial?.sending_domain ?? "");
  const [savingDomain, setSavingDomain] = useState(false);
  const set = (k: keyof SmtpState, v: unknown) => setS({ ...s, [k]: v });

  function saveDomain() {
    setSavingDomain(true);
    void setSendingDomainAction(domain.trim() || null).then((res) => {
      setSavingDomain(false);
      toast(
        res.ok
          ? { title: "Sending domain saved", description: res.message }
          : { variant: "destructive", title: "Couldn't save", description: res.message },
      );
    });
  }

  function save() {
    start(async () => {
      const res = await saveSellerSmtpAction({
        host: s.host,
        port: s.port,
        secure: s.secure,
        username: s.username,
        password: password || undefined,
        from_name: s.from_name,
        from_email: s.from_email,
        reply_to: s.reply_to,
        active: s.active,
      });
      if (res.ok) {
        setPassword("");
        toast({ title: "SMTP saved" });
      } else {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
      }
    });
  }

  function test() {
    setTesting(true);
    void testSellerSmtpAction().then((res) => {
      setTesting(false);
      toast(
        res.ok
          ? { title: "Test sent ✅", description: res.message }
          : { variant: "destructive", title: "Test failed", description: res.message },
      );
    });
  }

  return (
    <div className="card-surface space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">SMTP host</Label>
          <Input value={s.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.yourdomain.com" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Port</Label>
          <Input type="number" value={s.port} onChange={(e) => set("port", Number(e.target.value))} className="mt-1" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.secure} onChange={(e) => set("secure", e.target.checked)} />
            Implicit TLS (port 465)
          </label>
        </div>
        <div>
          <Label className="text-xs">Username</Label>
          <Input value={s.username} onChange={(e) => set("username", e.target.value)} placeholder="you@yourdomain.com" className="mt-1" autoComplete="off" />
        </div>
        <div>
          <Label className="text-xs">Password{s.configured ? " (leave blank to keep)" : ""}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" autoComplete="off" />
        </div>
        <div>
          <Label className="text-xs">From name</Label>
          <Input value={s.from_name ?? ""} onChange={(e) => set("from_name", e.target.value)} placeholder="Your Brand" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">From email</Label>
          <Input value={s.from_email} onChange={(e) => set("from_email", e.target.value)} placeholder="hello@yourdomain.com" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Reply-to (optional)</Label>
          <Input value={s.reply_to ?? ""} onChange={(e) => set("reply_to", e.target.value)} placeholder="support@yourdomain.com" className="mt-1" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.active} onChange={(e) => set("active", e.target.checked)} />
        Use my SMTP for buyer emails
      </label>

      <div className="border-t pt-3">
        <Label className="text-xs">Verified sending domain (optional)</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="mail.yourbrand.com"
            className="max-w-xs"
          />
          <Button variant="outline" onClick={saveDomain} disabled={savingDomain}>
            {savingDomain && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save domain
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The domain your mail is authenticated to send from (SPF/DKIM set up at your provider).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending || testing}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        <Button variant="outline" onClick={test} disabled={pending || testing}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send test email
        </Button>
      </div>
    </div>
  );
}
