"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, MoreVertical } from "lucide-react";

import {
  flagPageAction,
  restorePageAction,
  suspendPageAction,
  unflagPageAction,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface PageActionsMenuProps {
  pageId: string;
  pageSlug: string;
  /** Type-aware public path (/p, /tg or /ln). Falls back to /p/{slug}. */
  pagePath?: string;
  flagged: boolean;
  status: string;
}

export function PageActionsMenu({
  pageId,
  pageSlug,
  pagePath,
  flagged,
  status,
}: PageActionsMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function doFlag() {
    setBusy("flag");
    const r = await flagPageAction(pageId, flagReason);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't flag", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page flagged" });
    setFlagOpen(false);
    setFlagReason("");
    router.refresh();
  }

  async function run(name: string, fn: () => Promise<{ ok: boolean; message?: string }>, msg: string) {
    setBusy(name);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Action failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: msg });
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <a href={pagePath ?? `/p/${pageSlug}`} target="_blank" rel="noreferrer">Preview</a>
          </DropdownMenuItem>
          {flagged ? (
            <DropdownMenuItem
              onSelect={() => run("unflag", () => unflagPageAction(pageId), "Page unflagged")}
            >
              Remove flag
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setFlagOpen(true)}>
              <Flag className="mr-2 h-3.5 w-3.5" /> Flag for review
            </DropdownMenuItem>
          )}
          {status === "published" ? (
            <DropdownMenuItem
              onSelect={() => run("suspend", () => suspendPageAction(pageId), "Page suspended")}
              className="text-destructive focus:text-destructive"
            >
              Suspend page
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run("restore", () => restorePageAction(pageId), "Page restored")}
            >
              Restore page
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Flag page for review</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={3}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Reason (visible to admins + shown to the seller)"
          />
          <DialogFooter>
            <Button onClick={doFlag} disabled={busy === "flag"}>
              {busy === "flag" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
