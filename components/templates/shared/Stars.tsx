import { Star } from "lucide-react";

export function Stars({
  rating = 5,
  className = "text-yellow-400",
}: {
  rating?: number;
  className?: string;
}) {
  const full = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-4 w-4"
          fill={i < full ? "currentColor" : "transparent"}
        />
      ))}
    </div>
  );
}
