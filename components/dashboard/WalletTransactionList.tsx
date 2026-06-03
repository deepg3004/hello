import { formatINR } from "@/lib/utils";

export interface WalletTxRow {
  id: string;
  type: "credit" | "debit";
  amount_paise: number;
  description: string;
  balance_after: number;
  created_at: string;
  order_id: string | null;
}

/**
 * Wallet ledger — credits (recharges) and debits (platform fees). Plain
 * display component matching the dashboard table convention (.card-surface).
 */
export function WalletTransactionList({
  transactions,
}: {
  transactions: WalletTxRow[];
}) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Transactions</h2>
      </div>
      {transactions.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No wallet activity yet. Recharge to get started.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Balance after
                </th>
                <th className="px-4 py-2 font-medium text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((t) => {
                const credit = t.type === "credit";
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2">{t.description}</td>
                    <td
                      className={
                        credit
                          ? "px-4 py-2 text-right font-medium text-emerald-600"
                          : "px-4 py-2 text-right font-medium text-foreground"
                      }
                    >
                      {credit ? "+" : "−"}
                      {formatINR(t.amount_paise)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatINR(t.balance_after)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
