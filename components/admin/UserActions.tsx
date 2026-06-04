"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy } from "lucide-react";

import {
  addAdminNoteAction,
  changeUserPlanAction,
  restoreUserAction,
  sendPasswordResetLinkAction,
  suspendUserAction,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PLANS, type PlanKey } from "@/lib/plans";

interface UserActionsProps {
  userId: string;
  userEmail: string;
  currentPlan: string;
  suspended: boolean;
}

export function UserActions({
  userId,
  userEmail,
  currentPlan,
  suspended,
}: UserActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState<PlanKey>(currentPlan as PlanKey);
  const [suspendReason, setSuspendReason] = useState("");
  const [note, setNote] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function changePlan() {
    setBusy("plan");
    const r = await changeUserPlanAction(userId, newPlan);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't change plan", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Plan updated" });
    router.refresh();
  }

  async function suspend() {
    setBusy("suspend");
    const r = await suspendUserAction(userId, suspendReason);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't suspend", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "User suspended", description: "All published pages were paused." });
    router.refresh();
  }

  async function restore() {
    setBusy("restore");
    const r = await restoreUserAction(userId);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't restore", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "User restored" });
    router.refresh();
  }

  async function generateReset() {
    setBusy("reset");
    const r = await sendPasswordResetLinkAction(userEmail);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't generate", description: r.message, variant: "destructive" });
      return;
    }
    setResetLink(r.value ?? null);
    toast({ title: "Reset link generated" });
  }

  async function addNote() {
    setBusy("note");
    const r = await addAdminNoteAction(userId, note);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't add note", description: r.message, variant: "destructive" });
      return;
    }
    setNote("");
    toast({ title: "Note added" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Change plan */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Change plan</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New plan</Label>
            <Select value={newPlan} onValueChange={(v) => setNewPlan(v as PlanKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PLANS).map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name} {p.price > 0 && `· ₹${p.price}/mo`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={changePlan} disabled={busy === "plan"}>
              {busy === "plan" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Suspend / Restore */}
      {suspended ? (
        <Button variant="outline" size="sm" onClick={restore} disabled={busy === "restore"}>
          {busy === "restore" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Restore account
        </Button>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">Suspend account</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Suspend this account</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Reason (visible only to admins)</Label>
              <Textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. KYC fraud, multiple chargebacks…"
              />
              <p className="text-xs text-muted-foreground">
                Published pages will be paused immediately.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={suspend}
                disabled={busy === "suspend"}
              >
                {busy === "suspend" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Suspend
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Password reset */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" onClick={generateReset}>
            {busy === "reset" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Reset password
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password reset link</DialogTitle>
          </DialogHeader>
          {resetLink ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Share this single-use link with the user (valid 1h):
              </p>
              <div className="flex items-center gap-2">
                <Input value={resetLink} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(resetLink);
                    toast({ title: "Copied" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Generating…</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Add note */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Add note</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add admin note</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note about this user…"
          />
          <DialogFooter>
            <Button onClick={addNote} disabled={busy === "note" || !note.trim()}>
              {busy === "note" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
