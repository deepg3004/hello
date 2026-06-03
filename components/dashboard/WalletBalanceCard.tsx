import { Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

/**
 * Current wallet balance tile. Plain display component (no client hooks) so it
 * renders inside the server-component wallet page.
 */
export function WalletBalanceCard({
  balancePaise,
  autoRechargeEnabled,
}: {
  balancePaise: number;
  autoRechargeEnabled: boolean;
}) {
  const low = balancePaise <= 20000; // ₹200

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Wallet balance
        </CardTitle>
        <CardDescription>
          {autoRechargeEnabled ? "Auto-recharge is on." : "Platform fees are deducted per order."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p
          className={
            low
              ? "text-3xl font-semibold tracking-tight text-amber-600"
              : "text-3xl font-semibold tracking-tight"
          }
        >
          {formatINR(balancePaise)}
        </p>
        {low && (
          <p className="mt-1 text-xs text-amber-600">
            Low balance — recharge to keep your store active.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
