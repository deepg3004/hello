"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { acceptTeamInviteAction } from "@/actions/team";

export function AcceptInvite({ token, id }: { token: string; id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setBusy(true);
    setError(null);
    void acceptTeamInviteAction(token, id).then((res) => {
      if (res.ok) {
        // Cookie now points at the joined account — land on its dashboard.
        window.location.href = "/dashboard";
      } else {
        setBusy(false);
        setError(res.message ?? "Couldn't accept the invite.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={accept} disabled={busy} className="w-full">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Accept invite
      </Button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
