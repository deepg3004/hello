"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Upload endpoint that accepts `file` form-data and returns { url }.
   *  Default is the seller-accessible logo endpoint. Admin surfaces can pass
   *  "/api/learn/upload". */
  endpoint?: string;
  placeholder?: string;
  className?: string;
}

/**
 * A single control offering BOTH ways to set an image: paste a URL or upload a
 * file. Shows a small live preview. Used for logos and other image fields so
 * users aren't forced to host the image themselves.
 */
export function ImageInput({
  value,
  onChange,
  endpoint = "/api/telegram/upload-logo",
  placeholder = "Paste an image URL or upload",
  className,
}: Props) {
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
      const res = await fetch(endpoint, { method: "POST", body: fd });
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
    <div className={cn("flex items-center gap-2", className)}>
      {/* Preview */}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Upload an image"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
    </div>
  );
}
