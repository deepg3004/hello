import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function PastDueBanner() {
  return (
    <div className="bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Your subscription payment failed. Update billing to avoid page suspension.{" "}
        <Link href="/dashboard/upgrade" className="underline">
          Fix it
        </Link>
      </span>
    </div>
  );
}
