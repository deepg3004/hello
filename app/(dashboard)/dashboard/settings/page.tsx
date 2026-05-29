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
      "full_name, email, phone, kyc_level, bank_verified, pan_verified, gstin, business_slug:full_name, razorpay_linked_account_id",
    )
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, KYC and payout setup.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>What customers and we see.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row k="Full name" v={profile?.full_name ?? "—"} />
          <Row k="Email" v={profile?.email ?? user.email ?? ""} />
          <Row k="Phone" v={profile?.phone ?? "—"} />
          <Row k="GSTIN" v={profile?.gstin ?? "—"} />
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
          <CardTitle className="text-base">More settings</CardTitle>
          <CardDescription>Editor + KYC form ships next prompt.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          For now you can{" "}
          <Link href="/dashboard/upgrade" className="underline">
            manage your plan
          </Link>{" "}
          and{" "}
          <Link href="/dashboard/payouts" className="underline">
            view payouts
          </Link>
          .
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
