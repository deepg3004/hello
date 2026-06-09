"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2 } from "lucide-react";

import {
  saveDiscordSetupAction,
  verifyDiscordBotTokenAction,
  verifyGuildAction,
} from "@/actions/discord";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface PageOpt {
  id: string;
  title: string;
}

export function DiscordSetupWizard({ pages }: { pages: PageOpt[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  // Step 1 — bot token
  const [botToken, setBotToken] = useState("");
  const [bot, setBot] = useState<{ id: string; username: string } | null>(null);

  // Step 2 — guild
  const [guildId, setGuildId] = useState("");
  const [guild, setGuild] = useState<{
    guild_id: string;
    name: string;
    bot_can_kick: boolean;
    invite_channel_id: string | null;
  } | null>(null);

  // Step 3 — access config
  const [accessDays, setAccessDays] = useState("30");
  const [autoRenew, setAutoRenew] = useState(true);
  const [pageId, setPageId] = useState<string>("");
  const [appPublicKey, setAppPublicKey] = useState("");

  async function checkToken() {
    setBusy(true);
    const r = await verifyDiscordBotTokenAction(botToken);
    setBusy(false);
    if (!r.ok || !r.data) {
      toast({ variant: "destructive", title: "Couldn't verify bot", description: r.message });
      return;
    }
    setBot(r.data);
  }

  async function checkGuild() {
    setBusy(true);
    const r = await verifyGuildAction(botToken, guildId);
    setBusy(false);
    if (!r.ok || !r.data) {
      toast({ variant: "destructive", title: "Couldn't verify server", description: r.message });
      return;
    }
    if (!r.data.invite_channel_id) {
      toast({
        variant: "destructive",
        title: "No invite channel found",
        description: "Create at least one text channel the bot can see, then retry.",
      });
      return;
    }
    setGuild(r.data);
  }

  function save() {
    if (!bot || !guild) return;
    start(async () => {
      const r = await saveDiscordSetupAction({
        bot_token: botToken.trim(),
        bot_username: bot.username,
        guild_id: guild.guild_id,
        guild_name: guild.name,
        invite_channel_id: guild.invite_channel_id,
        access_duration_days: Math.max(0, parseInt(accessDays || "0", 10)),
        auto_renewal_enabled: autoRenew,
        app_public_key: appPublicKey.trim() || undefined,
        page_id: pageId || undefined,
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Save failed", description: r.message });
        return;
      }
      toast({ title: "Discord connected", description: r.message ?? "Your server is live." });
      // Guard against an empty id → don't navigate to /dashboard/discord/ (404).
      router.push(r.data?.id ? `/dashboard/discord/${r.data.id}` : "/dashboard/discord");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Step 1 — bot token */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-2">
            <StepDot done={!!bot} n={1} />
            <h2 className="font-medium">Connect your bot</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Create a bot in the{" "}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Discord Developer Portal <ExternalLink className="h-3 w-3" />
            </a>
            , enable the <strong>Server Members Intent</strong>, and paste its{" "}
            <strong>Bot Token</strong> below.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              placeholder="Bot token"
              value={botToken}
              onChange={(e) => {
                setBotToken(e.target.value);
                setBot(null);
                setGuild(null);
              }}
            />
            <Button onClick={checkToken} disabled={busy || !botToken.trim()}>
              {busy && !bot ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
          {bot && (
            <p className="text-sm text-emerald-600">
              <Check className="mr-1 inline h-4 w-4" />
              Connected as <strong>{bot.username}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — server */}
      {bot && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2">
              <StepDot done={!!guild} n={2} />
              <h2 className="font-medium">Add the bot to your server</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Invite the bot to your server with the{" "}
              <strong>Create Invite</strong> and <strong>Kick Members</strong>{" "}
              permissions, then enable Developer Mode in Discord, right-click your
              server → <strong>Copy Server ID</strong>, and paste it below.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Server (guild) ID"
                value={guildId}
                onChange={(e) => {
                  setGuildId(e.target.value);
                  setGuild(null);
                }}
              />
              <Button onClick={checkGuild} disabled={busy || !guildId.trim()}>
                {busy && !guild ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            </div>
            {guild && (
              <p className="text-sm text-emerald-600">
                <Check className="mr-1 inline h-4 w-4" />
                Found <strong>{guild.name}</strong>
                {!guild.bot_can_kick && (
                  <span className="block text-amber-600">
                    Heads up: the bot cannot kick members, so expired buyers will
                    not be removed automatically.
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3 — access config */}
      {guild && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex items-center gap-2">
              <StepDot done={false} n={3} />
              <h2 className="font-medium">Access & sales page</h2>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="days">Access duration (days)</Label>
              <Input
                id="days"
                type="number"
                min={0}
                value={accessDays}
                onChange={(e) => setAccessDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                0 = lifetime access (never expires).
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Send renewal reminders</p>
                <p className="text-xs text-muted-foreground">
                  Email buyers 3 days and 1 day before access ends.
                </p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>

            <div className="grid gap-2">
              <Label>Link a sales page (optional)</Label>
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Buyers of this page get access" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When someone pays for this page, they are invited automatically.
                You can link a page later from the page editor too.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="appkey">App public key (optional)</Label>
              <Input
                id="appkey"
                placeholder="From Discord Developer Portal → General Information"
                value={appPublicKey}
                onChange={(e) => setAppPublicKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Only needed if you set an Interactions Endpoint URL in Discord. Lets
                us verify Discord&apos;s signed requests. Leave blank otherwise.
              </p>
            </div>

            <Button onClick={save} disabled={pending} className="w-full">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Finish & connect"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepDot({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
        (done
          ? "bg-emerald-600 text-white"
          : "bg-muted text-muted-foreground")
      }
    >
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );
}
