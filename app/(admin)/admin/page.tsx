import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
        <p className="text-sm text-muted-foreground">
          Sellers, payouts, commissions and disputes.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GMV today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">₹0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commission earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">₹0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active sellers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">0</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
