import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to InvoxAI</h1>
        <p className="text-sm text-muted-foreground">
          Three quick steps and you&apos;ll be ready to accept payments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Complete your profile</CardTitle>
          <CardDescription>
            Add your business name and GSTIN if you have one.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Profile editor — coming next.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Verify your bank for payouts</CardTitle>
          <CardDescription>
            We need this before sending you money.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Bank + KYC flow — coming next.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Build your first page</CardTitle>
          <CardDescription>
            A payment page or landing page, your call.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Page builder — coming next.
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
