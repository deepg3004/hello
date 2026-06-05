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
import { getActorContext } from "@/lib/account-context";
import {
  ProfileSettingsForm,
  PasswordChangeForm,
} from "@/components/dashboard/ProfileSettingsForm";
import { TwoFactorSettings } from "@/components/dashboard/TwoFactorSettings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");
  // Settings is a hub of account config — keep Staff (no settings access) out.
  if (
    !ctx.can("domains.view") &&
    !ctx.can("billing.view") &&
    !ctx.can("gateway.view") &&
    !ctx.can("team.view")
  ) {
    redirect("/dashboard");
  }

  // The profile card edits the LOGGED-IN user's own identity (not the owner's).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "full_name, email, phone, gstin, creator_category",
    )
    .eq("id", ctx.authUserId)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, gateway, and account setup.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Your name, phone, GSTIN, and creator category — used on invoices and
            across the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileSettingsForm
            initialName={profile?.full_name ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialGstin={profile?.gstin ?? ""}
            initialCategory={profile?.creator_category ?? ""}
          />
          <div className="border-t pt-3 text-sm">
            <Row k="Email" v={profile?.email ?? ""} />
            <p className="mt-1 text-xs text-muted-foreground">
              Email changes aren&apos;t self-serve yet — contact support.
            </p>
          </div>
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

      {ctx.can("gateway.view") && (
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
      )}

      {ctx.can("billing.view") && (
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
      )}

      {ctx.can("team.view") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team &amp; Roles</CardTitle>
            <CardDescription>
              Invite teammates and assign roles (Manager, Staff, Viewer).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href="/dashboard/settings/team"
              className="text-primary underline"
            >
              Manage team →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            WhatsApp + email alerts for sales and new leads.
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
          <CardTitle className="text-base">Email Integrations</CardTitle>
          <CardDescription>
            Send buyer emails (receipts, lead &amp; booking confirmations) from
            your own domain via custom SMTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href="/dashboard/settings/email"
            className="text-primary underline"
          >
            Configure email →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Help &amp; Support</CardTitle>
          <CardDescription>
            Open a support ticket — we reply by email and in your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link href="/dashboard/support" className="text-primary underline">
            Get help →
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
