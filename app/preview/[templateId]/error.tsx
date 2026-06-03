"use client";

// Safety net for the preview iframe: if a template throws while rendering with
// the seller's current values, show a friendly message instead of crashing the
// route (which would surface as a Cloudflare 520 in the editor's live preview).

import { AlertTriangle } from "lucide-react";

export default function PreviewError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-zinc-200">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="font-sora text-lg font-semibold">Preview hit a snag</p>
      <p className="max-w-sm text-sm text-zinc-400">
        One of the fields has an unexpected value. Keep editing — your page is
        safe — and the preview will refresh.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
      >
        Retry preview
      </button>
    </div>
  );
}
