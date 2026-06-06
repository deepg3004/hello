"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

import {
  claimCustomDomainAction,
  claimSubdomainAction,
  refreshCustomDomainStatusAction,
  removeCustomDomainAction,
  setSubdomainRedirectAction,
  verifyCustomDomainAction,
} from "@/actions/domains";
import type { DcvRecord } from "@/lib/cloudflare";
import {
  HARD_RESERVED_SUBDOMAINS,
  normaliseDomain,
  normaliseSubdomain,
  validateDomain,
  validateSubdomain,
} from "@/lib/domains";

type CertStatus = "pending" | "provisioning" | "active" | "failed" | null;

interface Props {
  rootDomain: string;
  appRootHost: string;
  customDomainTarget: string;
  subdomainRedirectToCustom: boolean;
  subdomain: string | null;
  subdomainClaimedAt: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
  customDomainCertStatus: CertStatus;
  customDomainLastCheckedAt: string | null;
  customDomainLastError: string | null;
  customDomainDcv: DcvRecord[] | null;
  canUseCustomDomains: boolean;
  plan: string;
}

export function DomainSettingsForm(props: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // ── Subdomain
  const [subdomain, setSubdomain] = useState(props.subdomain ?? "");
  const sd = normaliseSubdomain(subdomain);
  const sdValid = validateSubdomain(sd);

  function saveSubdomain() {
    if (!sdValid.ok) {
      toast({
        variant: "destructive",
        title: "Invalid subdomain",
        description: sdValid.message,
      });
      return;
    }
    startTransition(async () => {
      const res = await claimSubdomainAction({ subdomain: sd });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: res.message,
        });
        return;
      }
      toast({
        title: "Subdomain saved 🎉",
        description: res.message,
      });
    });
  }

  // ── Custom domain
  const [customDomain, setCustomDomain] = useState(
    props.customDomain ?? "",
  );
  const cd = normaliseDomain(customDomain);
  const cdValid = validateDomain(cd);

  // ── Subdomain → custom-domain redirect toggle
  const [redirectOn, setRedirectOn] = useState(
    props.subdomainRedirectToCustom,
  );

  function toggleRedirect(next: boolean) {
    const prev = redirectOn;
    setRedirectOn(next); // optimistic
    startTransition(async () => {
      const res = await setSubdomainRedirectAction({ enabled: next });
      if (!res.ok) {
        setRedirectOn(prev); // revert on failure
        toast({
          variant: "destructive",
          title: "Couldn't update",
          description: res.message,
        });
        return;
      }
      toast({ title: next ? "Redirect on" : "Redirect off", description: res.message });
    });
  }

  function saveCustomDomain() {
    if (!cdValid.ok) {
      toast({
        variant: "destructive",
        title: "Invalid domain",
        description: cdValid.message,
      });
      return;
    }
    startTransition(async () => {
      const res = await claimCustomDomainAction({ domain: cd });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: res.message,
        });
        return;
      }
      toast({
        title: "Domain saved",
        description:
          "Now add the A record on your DNS host and click Verify below.",
      });
    });
  }

  function verifyCustomDomain() {
    startTransition(async () => {
      const res = await verifyCustomDomainAction();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Not verified yet",
          description: res.message,
        });
        return;
      }
      toast({ title: "Verified", description: res.message });
    });
  }

  function refreshStatus() {
    startTransition(async () => {
      const res = await refreshCustomDomainStatusAction();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't refresh",
          description: res.message,
        });
        return;
      }
      toast({ title: "Status updated", description: res.message });
    });
  }

  function removeCustomDomain() {
    if (!confirm("Disconnect this domain?")) return;
    startTransition(async () => {
      const res = await removeCustomDomainAction();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't disconnect",
          description: res.message,
        });
        return;
      }
      setCustomDomain("");
      toast({ title: "Disconnected" });
    });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      /* fall through */
    }
  }

  const fullSubdomain = sd ? `${sd}.${props.rootDomain}` : "";
  const subdomainTaken = props.subdomain === sd && sd.length >= 3;

  return (
    <div className="space-y-6">
      {/* Subdomain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            invoxai.io subdomain
            {props.subdomain && (
              <Badge
                variant="outline"
                className="ml-2 align-middle border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
              >
                <ShieldCheck className="mr-1 h-3 w-3" />
                Claimed
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Pick a 3–30 character handle made of lowercase letters, numbers
            and hyphens. Your pages live at{" "}
            <code>{`{handle}.${props.rootDomain}/{page-slug}`}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Subdomain</Label>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-md border bg-background">
                <Input
                  value={subdomain}
                  onChange={(e) =>
                    setSubdomain(e.target.value.toLowerCase())
                  }
                  className="border-0 focus-visible:ring-0"
                  placeholder="rahul"
                  maxLength={30}
                />
                <span className="px-3 text-sm text-muted-foreground">
                  .{props.rootDomain}
                </span>
              </div>
              <Button
                onClick={saveSubdomain}
                disabled={pending || !sdValid.ok || subdomainTaken}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {props.subdomain
                  ? subdomainTaken
                    ? "Saved"
                    : "Change"
                  : "Claim"}
              </Button>
            </div>
            {sd && !sdValid.ok ? (
              <p className="mt-1 text-xs text-destructive">{sdValid.message}</p>
            ) : sd && HARD_RESERVED_SUBDOMAINS.has(sd) ? (
              <p className="mt-1 text-xs text-destructive">Reserved.</p>
            ) : sd ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Your pages will live at <code>{fullSubdomain}</code>.
              </p>
            ) : null}
          </div>

          {props.subdomain && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <code className="text-xs">
                {props.subdomain}.{props.rootDomain}
              </code>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copy(
                      `https://${props.subdomain}.${props.rootDomain}`,
                      "Subdomain URL",
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  size="sm"
                >
                  <a
                    href={`https://${props.subdomain}.${props.rootDomain}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom domain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Custom domain
            {props.customDomainVerifiedAt && (
              <Badge
                variant="outline"
                className="border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Bring your own hostname — e.g.{" "}
            <code>pages.yourbrand.com</code> or your root domain. Two steps: add
            the domain here, then an A record at your DNS host pointing to{" "}
            <code>{props.customDomainTarget}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!props.canUseCustomDomains && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/10 dark:text-amber-200">
              Custom domains are disabled platform-wide right now. Check back
              later.
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <Label className="text-xs">Your domain</Label>
              <Input
                value={customDomain}
                onChange={(e) =>
                  setCustomDomain(e.target.value.toLowerCase().trim())
                }
                placeholder="pages.yourbrand.com"
                disabled={!props.canUseCustomDomains}
              />
              {cd && !cdValid.ok && (
                <p className="mt-1 text-xs text-destructive">{cdValid.message}</p>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={saveCustomDomain}
                disabled={
                  pending ||
                  !cdValid.ok ||
                  cd === props.customDomain ||
                  !props.canUseCustomDomains
                }
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {props.customDomain ? "Update" : "Add domain"}
              </Button>
              {props.customDomain && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeCustomDomain}
                  disabled={pending}
                  title="Disconnect"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {props.customDomain && (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  DNS record to add at your registrar
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Type</p>
                    <p>A</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Name / Host
                    </p>
                    <p className="truncate">{leftLabel(props.customDomain)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Value / IP</p>
                    <div className="flex items-center gap-1">
                      <span className="truncate">
                        {props.customDomainTarget}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copy(props.customDomainTarget, "IP address")
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Using a root domain? Add a second A record with Name{" "}
                  <code>www</code> pointing to the same IP. DNS normally
                  propagates in 1–10 minutes — longer if your TTL is high.
                </p>
              </div>

              {props.customDomainDcv && props.customDomainDcv.length > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 text-sm dark:border-blue-500/30 dark:bg-blue-900/10">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Extra record to finish the SSL certificate
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add this at your DNS host so we can issue the HTTPS
                    certificate, then click “Refresh status”.
                  </p>
                  <div className="mt-2 space-y-2">
                    {props.customDomainDcv.map((rec, i) => (
                      <div
                        key={`${rec.name}-${i}`}
                        className="grid grid-cols-3 gap-2 font-mono text-xs"
                      >
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            Type
                          </p>
                          <p className="uppercase">{rec.type}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">
                            Name / Host
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="truncate">{rec.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => copy(rec.name, "Name")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">
                            Value
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="truncate">{rec.value}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => copy(rec.value, "Value")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    Status: {certBadge(props.customDomainCertStatus, !!props.customDomainVerifiedAt)}
                  </p>
                  {props.customDomainLastError && (
                    <p className="mt-1 text-xs text-destructive">
                      {props.customDomainLastError}
                    </p>
                  )}
                  {props.customDomainLastCheckedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last checked{" "}
                      {new Date(props.customDomainLastCheckedAt).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {props.customDomainVerifiedAt &&
                    props.customDomainCertStatus !== "active" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={refreshStatus}
                        disabled={pending}
                      >
                        {pending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Refresh status
                      </Button>
                    )}
                  <Button onClick={verifyCustomDomain} disabled={pending}>
                    {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify DNS
                  </Button>
                </div>
              </div>

              {props.customDomainVerifiedAt && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div className="min-w-0 pr-3">
                    <p className="font-medium">
                      Redirect my InvoxAI subdomain to this domain
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {props.subdomain ? (
                        <>
                          Send <code>{props.subdomain}.{props.rootDomain}</code>{" "}
                          → <code>{props.customDomain}</code> for every page, so
                          your custom domain is the only address visitors see.
                        </>
                      ) : (
                        <>Claim a subdomain above first to use this.</>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={redirectOn}
                    onCheckedChange={toggleRedirect}
                    disabled={pending || !props.subdomain}
                    aria-label="Redirect subdomain to custom domain"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function leftLabel(host: string): string {
  const parts = host.split(".");
  if (parts.length < 3) return "@";
  return parts.slice(0, parts.length - 2).join(".");
}

function certBadge(
  status: CertStatus,
  verified: boolean,
): React.ReactNode {
  if (status === "active" || (verified && !status)) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  }
  if (status === "provisioning") {
    return (
      <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-500/30 dark:text-blue-300">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Issuing certificate
      </Badge>
    );
  }
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return <Badge variant="outline">Awaiting DNS</Badge>;
}
