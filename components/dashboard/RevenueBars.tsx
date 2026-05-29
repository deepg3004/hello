import Link from "next/link";

interface RevenueBarsProps {
  rows: Array<{ id: string; title: string; slug: string; total_revenue: number }>;
}

export function RevenueBars({ rows }: RevenueBarsProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No revenue yet. When orders come in, your top pages will appear here.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.total_revenue), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = Math.round((r.total_revenue / max) * 100);
        return (
          <li key={r.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <Link href={`/p/${r.slug}`} className="font-medium hover:underline" target="_blank">
                {r.title}
              </Link>
              <span className="font-mono">₹{r.total_revenue.toLocaleString("en-IN")}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
