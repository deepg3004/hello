"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { completeOnboardingAction } from "@/actions/onboarding";

interface Props {
  complete: boolean;
  onboardedAt: string | null;
}

export function OnboardingControls({ complete, onboardedAt }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const alreadyDone = !!onboardedAt;

  function finish() {
    startTransition(async () => {
      const res = await completeOnboardingAction();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't finish",
          description: res.message,
        });
        return;
      }
      toast({ title: "You're all set — welcome aboard!" });
      router.push("/dashboard");
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4 text-sm">
      <p className="text-muted-foreground">
        {alreadyDone
          ? "You already finished onboarding. Come back any time to revisit the checklist."
          : complete
            ? "All required steps are done. Hit Finish to wrap up."
            : "Wrap up later — your progress sticks."}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          Skip for now
        </Button>
        <Button onClick={finish} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Finish onboarding
        </Button>
      </div>
    </div>
  );
}
