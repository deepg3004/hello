import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PayoutSettingsForm } from "@/components/dashboard/PayoutSettingsForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { maskLast4 } from "@/lib/kyc/surepass";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payouts";

export const metadata = { title: "Payout settings" };

export default async function PayoutSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "kyc_level, bank_verified, bank_account_number, bank_ifsc, bank_holder_name, payout_gateway, payout_schedule, payout_min_threshold",
    )
    .eq("id", user.id)
    .single();

  const kycComplete = !!profile?.bank_verified && (profile?.kyc_level ?? 0) >= 2;
  const schedule = (profile?.payout_schedule ?? "manual") as "manual" | "weekly" | "monthly";
  const gateway = (profile?.payout_gateway ?? "razorpay") as
    | "razorpay"
    | "cashfree"
    | "manual";
  const threshold = Number(profile?.payout_min_threshold ?? MIN_PAYOUT_AMOUNT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Payout settings</h1>
        <p className="text-sm text-muted-foreground">
          Where your money goes, how often, and via which rail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank account</CardTitle>
          <CardDescription>
            Verified via Surepass penny drop during KYC. Changing it requires re-verifying.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {profile?.bank_account_number ? (
            <>
              <Row k="Holder" v={profile.bank_holder_name ?? "—"} />
              <Row k="Account" v={maskLast4(profile.bank_account_number)} mono />
              <Row k="IFSC" v={profile.bank_ifsc ?? "—"} mono />
              <Row
                k="Status"
                v={profile.bank_verified ? "Verified" : "Not verified"}
                tone={profile.bank_verified ? "ok" : "warn"}
              />
            </>
          ) : (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-muted-foreground">
              No bank account on file yet.
            </p>
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            To change your bank, complete KYC again with the new account.{" "}
            <Link href="/dashboard/kyc" className="underline">
              Open KYC
            </Link>
          </p>
        </CardContent>
      </Card>

      {!kycComplete && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">KYC Level 2 required for payouts</p>
            <p className="mt-1">
              Finish PAN + bank verification on{" "}
              <Link href="/dashboard/kyc" className="underline">
                the KYC page
              </Link>{" "}
              to unlock automated payouts.
            </p>
          </div>
        </div>
      )}

      {kycComplete && (
        <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Payouts enabled</p>
            <p className="mt-1">Request payouts any time from the Payouts page.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <PayoutSettingsForm
            initialSchedule={schedule}
            initialThreshold={threshold}
            initialGateway={gateway}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  tone,
}: {
  k: string;
  v: string;
  mono?: boolean;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={
          (mono ? "font-mono " : "") +
          (tone === "ok"
            ? "text-emerald-600 font-medium"
            : tone === "warn"
              ? "text-amber-600 font-medium"
              : "font-medium")
        }
      >
        {v}
      </span>
    </div>
  );
}
