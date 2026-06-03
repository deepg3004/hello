import { redirect } from "next/navigation";

// Payout settings retired — redirect to the main settings page.
export default function PayoutSettingsPage() {
  redirect("/dashboard/settings");
}
