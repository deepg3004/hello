import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Read-only star row (supports half stars). */
export function Stars({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const full = Math.floor(value);
  const half = value - full >= 0.25 && value - full < 0.75;
  const rounded = value - full >= 0.75 ? full + 1 : full;
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={`${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const isFull = half ? i < full : i < rounded;
        const isHalf = half && i === full;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              style={{ width: size, height: size }}
              className="absolute inset-0 text-amber-400"
              fill={isFull ? "currentColor" : "none"}
              strokeWidth={1.5}
            />
            {isHalf && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
                <Star
                  style={{ width: size, height: size }}
                  className="text-amber-400"
                  fill="currentColor"
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
