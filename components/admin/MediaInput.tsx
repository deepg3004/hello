"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ACCEPT: Record<string, string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/webm,video/quicktime",
  both: "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime",
};

interface Props {
  value: string;
  onChange: (url: string) => void;
  accept?: "image" | "video" | "both";
  placeholder?: string;
}

/** A text field (paste a URL) with an upload button to the learn-media bucket. */
export function MediaInput({ value, onChange, accept = "both", placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/learn/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast({ variant: "destructive", title: "Upload failed", description: json.error });
      } else {
        onChange(json.url);
        toast({ title: "Uploaded" });
      }
    } catch {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Paste a URL or upload"}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT[accept]}
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Upload a file"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
