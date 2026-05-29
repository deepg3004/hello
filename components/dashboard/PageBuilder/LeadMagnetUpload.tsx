"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File, Loader2, Trash2, UploadCloud } from "lucide-react";

import { removeLeadMagnetAction, uploadLeadMagnetAction } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { LeadMagnetMeta } from "@/lib/leads";

interface LeadMagnetUploadProps {
  pageId: string;
  initial?: LeadMagnetMeta | null;
}

export function LeadMagnetUpload({ pageId, initial }: LeadMagnetUploadProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [current, setCurrent] = useState<LeadMagnetMeta | null>(initial ?? null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("upload");
    const fd = new FormData();
    fd.append("pageId", pageId);
    fd.append("file", f);
    const r = await uploadLeadMagnetAction(fd);
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    if (!r.ok || !r.data) {
      toast({ title: "Upload failed", description: r.message, variant: "destructive" });
      return;
    }
    setCurrent(r.data);
    toast({ title: "Uploaded" });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Remove the lead magnet file?")) return;
    setBusy("remove");
    const r = await removeLeadMagnetAction(pageId);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't remove", description: r.message, variant: "destructive" });
      return;
    }
    setCurrent(null);
    router.refresh();
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-sm font-medium">Lead magnet file</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        PDF, ZIP or image up to 50 MB. We&apos;ll email a signed download link
        (valid 7 days) to each lead.
      </p>
      {current ? (
        <div className="mt-3 flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
          <File className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 truncate">
            <div className="truncate font-medium">{current.name}</div>
            <div className="text-xs text-muted-foreground">
              {current.size ? `${Math.ceil((current.size ?? 0) / 1024)} KB` : ""}
              {current.mime ? ` · ${current.mime}` : ""}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={busy === "remove"}
            aria-label="Remove"
            className="text-destructive hover:text-destructive"
          >
            {busy === "remove" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.zip,image/*"
            onChange={onFile}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy === "upload"}
            className="w-full"
          >
            {busy === "upload" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Upload file
          </Button>
        </div>
      )}
    </div>
  );
}
