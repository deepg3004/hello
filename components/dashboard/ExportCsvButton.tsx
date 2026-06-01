import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Download link to the seller-scoped CSV export endpoint. */
export function ExportCsvButton({
  type,
  label = "Export CSV",
}: {
  type: "orders" | "customers" | "leads";
  label?: string;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/export/${type}.csv`} download>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}
