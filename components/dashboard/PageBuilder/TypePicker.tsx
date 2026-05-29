"use client";

import { CreditCard, Globe, Magnet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PageDbType } from "@/lib/templates/types";

const OPTIONS: Array<{
  value: PageDbType;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "payment",
    label: "Payment page",
    desc: "Sell a course, coaching, e-book, or Telegram VIP access.",
    Icon: CreditCard,
  },
  {
    value: "landing",
    label: "Landing page",
    desc: "Webinar or event registration — collect names and emails.",
    Icon: Globe,
  },
  {
    value: "lead_magnet",
    label: "Lead magnet",
    desc: "Free download in exchange for an email address.",
    Icon: Magnet,
  },
];

interface TypePickerProps {
  value: PageDbType | null;
  onChange: (v: PageDbType) => void;
}

export function TypePicker({ value, onChange }: TypePickerProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="text-left focus:outline-none"
          >
            <Card
              className={cn(
                "h-full transition",
                selected
                  ? "border-primary shadow-md"
                  : "hover:border-foreground/30",
              )}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <opt.Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{opt.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{opt.desc}</CardDescription>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
