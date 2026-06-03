import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ProfileSettingsForm,
  PasswordChangeForm,
} from "@/components/dashboard/ProfileSettingsForm";
import { TwoFactorSettings } from "@/components/dashboard/TwoFactorSettings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "full_name, email, phone, kyc_level, bank_verified, pan_verified, gstin, razorpay_linked_account_id",
    )
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, KYC and payout setup.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Your name, phone, and GSTIN — used on invoices and the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileSettingsForm
            initialName={profile?.full_name ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialGstin={profile?.gstin ?? ""}
          />
          <div className="border-t pt-3 text-sm">
            <Row k="Email" v={profile?.email ?? user.email ?? ""} />
            <p className="mt-1 text-xs text-muted-foreground">
              Email changes aren&apos;t self-serve yet — contact support.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">KYC &amp; payouts</CardTitle>
          <CardDescription>
            Required before InvoxAI can send you money.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row k="KYC level" v={String(profile?.kyc_level ?? 0)} />
          <Row k="PAN verified" v={profile?.pan_verified ? "Yes" : "No"} />
          <Row k="Bank verified" v={profile?.bank_verified ? "Yes" : "No"} />
          <Row
            k="Linked account"
            v={profile?.razorpay_linked_account_id ?? "Not yet set up"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domains</CardTitle>
          <CardDescription>
            Claim your *.invoxai.io subdomain or bring your own hostname.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href="/dashboard/settings/domains"
            className="text-primary underline"
          >
            Configure domains →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Gateway</CardTitle>
          <CardDescription>
            Connect Razorpay or Cashfree to receive buyer payments directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href="/dashboard/settings/gateway"
            className="text-primary underline"
          >
            Configure gateway →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax &amp; Billing</CardTitle>
          <CardDescription>
            GST profile that drives every invoice we generate.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href="/dashboard/settings/tax-billing"
            className="text-primary underline"
          >
            Configure GST profile →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            WhatsApp + email alerts for sales, leads, payouts, and KYC updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href="/dashboard/settings/notifications"
            className="text-primary underline"
          >
            Configure notifications →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>
            Change the password you use to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>
            Add an authenticator-app code to your login for extra security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSettings />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
