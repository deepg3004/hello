"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/** Reusable image field: upload a file (→ public URL) OR paste a URL. Shows a
 *  preview thumbnail. Used across the dashboard for logos, favicons, product
 *  photos, banners, etc. */
export function ImageUpload({
  value,
  onChange,
  placeholder = "Paste an image URL or upload",
  className,
  previewClassName = "h-10 w-10 rounded object-cover",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  className?: string;
  previewClassName?: string;
}) {
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
      const res = await fetch("/api/uploads/image", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast({ variant: "destructive", title: "Upload failed", description: json.error });
      } else {
        onChange(json.url);
        toast({ title: "Image uploaded" });
      }
    } catch {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={"flex items-center gap-2 " + (className ?? "")}>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={"shrink-0 border " + previewClassName} />
      ) : (
        <div className={"flex shrink-0 items-center justify-center border bg-muted " + previewClassName}>
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
          <X className="h-4 w-4" />
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        <span className="hidden sm:inline">Upload</span>
      </button>
    </div>
  );
}
