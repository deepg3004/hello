"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/hooks/use-toast";
import { setPageFeeCategoryAction } from "@/actions/admin-wallet";

/**
 * Admin-only per-page fee-category override. "" = auto (derive from page type).
 */
export function PageFeeCategorySelect({
  pageId,
  current,
  options,
}: {
  pageId: string;
  current: string | null;
  options: { key: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(current ?? "");

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setPageFeeCategoryAction({
        pageId,
        feeCategory: next || null,
      });
      if (!res.ok) {
        setValue(prev);
        toast({ variant: "destructive", title: "Couldn't update", description: res.message });
        return;
      }
      toast({ title: "Fee category updated" });
      router.refresh();
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      <option value="">Auto (by type)</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
